// Venda do plano Pro por plataformas externas (Kiwify ou Shopify).
//
// 1. Crie o produto na plataforma (mensal e anual) e cadastre os links de pagamento em
//    RECEBI_CHECKOUT_MENSAL_URL e RECEBI_CHECKOUT_ANUAL_URL.
// 2. Cadastre o webhook da plataforma apontando para /recebi/api/pagamentos/kiwify (token em
//    KIWIFY_WEBHOOK_TOKEN) ou /recebi/api/pagamentos/shopify (segredo em SHOPIFY_WEBHOOK_SECRET).
// 3. Quando o pagamento é aprovado, o Pro é liberado na conta com o mesmo e-mail (ou com o
//    identificador que mandamos no link). Sem conta encontrada, o admin vincula manualmente.
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { externalPayments, payments, users, type User } from "@/db/schema";
import { notify } from "./activity";
import { normalizeEmail } from "./auth";
import { extendPro } from "./billing";
import { APP_PATH } from "./config";
import { addMonthsToDate, todayISO } from "./dates";
import { countDiscountUse } from "./coupons";
import { emailEnabled, readEnv } from "./email";
import { sendProActivatedEmail } from "./notifications";
import { type ExternalEvent, type Provider } from "./payment-providers";
import { grantReferralReward, revokeReferralReward } from "./referral";

export function externalCheckoutEnabled(): boolean {
  return !!readEnv("RECEBI_CHECKOUT_MENSAL_URL") || !!readEnv("RECEBI_CHECKOUT_ANUAL_URL");
}

export function checkoutProviderName(): string {
  const url = readEnv("RECEBI_CHECKOUT_MENSAL_URL") ?? readEnv("RECEBI_CHECKOUT_ANUAL_URL") ?? "";
  if (/kiwify/i.test(url)) return "Kiwify";
  if (/shopify|\/cart\//i.test(url)) return "Shopify";
  return "nossa plataforma de pagamento";
}

/** Link de pagamento com o e-mail e o id da conta, para a liberação ser automática. */
export function externalCheckoutUrl(
  user: Pick<User, "id" | "email" | "name"> & { checkoutCoupon?: string },
  plan: "mensal" | "anual",
): string | null {
  const base = readEnv(plan === "anual" ? "RECEBI_CHECKOUT_ANUAL_URL" : "RECEBI_CHECKOUT_MENSAL_URL");
  if (!base) return null;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (/\/cart\//.test(url.pathname) || /myshopify\.com$/.test(url.hostname)) {
    url.searchParams.set("checkout[email]", user.email);
    url.searchParams.set("attributes[recebi_user]", user.id);
    if (user.checkoutCoupon) url.searchParams.set("discount", user.checkoutCoupon);
  } else {
    // Kiwify: preenche o e-mail e devolve o "sck" no webhook (TrackingParameters).
    url.searchParams.set("email", user.email);
    url.searchParams.set("name", user.name);
    url.searchParams.set("sck", user.id);
    url.searchParams.set("src", "recebi");
    if (user.checkoutCoupon) url.searchParams.set("coupon", user.checkoutCoupon);
  }
  return url.toString();
}

async function findUser(event: ExternalEvent) {
  const db = getDb();
  if (event.userHint && /^[0-9a-f-]{36}$/i.test(event.userHint)) {
    const [byId] = await db.select().from(users).where(eq(users.id, event.userHint)).limit(1);
    if (byId && !byId.isDemo) return byId;
  }
  if (!event.email) return null;
  const [byEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(event.email)))
    .limit(1);
  if (!byEmail || byEmail.isDemo) return null;
  // Com e-mails ativos, só confiamos no e-mail da conta se ele foi confirmado (senão, o admin vincula).
  if (emailEnabled() && !byEmail.emailVerifiedAt) return null;
  return byEmail;
}

/** Libera o Pro de um pagamento aprovado para uma conta. */
async function activate(user: User, event: ExternalEvent, rowId: string): Promise<boolean> {
  const db = getDb();
  const inserted = await db
    .insert(payments)
    .values({
      id: `${event.provider}:${event.externalId}`,
      userId: user.id,
      provider: event.provider,
      status: "aprovado",
      amountCents: event.amountCents,
      months: event.months,
    })
    .onConflictDoNothing()
    .returning({ id: payments.id });
  await db.update(externalPayments).set({ userId: user.id, handledAt: new Date().toISOString() }).where(eq(externalPayments.id, rowId));
  if (inserted.length === 0) return false;
  const until = await extendPro(user, event.months);
  // Cupom de desconto usado no link: conta o uso e limpa da conta.
  if (user.checkoutCoupon) {
    await countDiscountUse(user.checkoutCoupon);
    await db.update(users).set({ checkoutCoupon: "" }).where(eq(users.id, user.id));
  }
  await notify(user.id, {
    type: "pro",
    title: "Seu plano Pro está ativo ✨",
    body: `Pagamento confirmado. Válido até ${until.split("-").reverse().join("/")}.`,
    href: `${APP_PATH}/plano`,
  });
  await sendProActivatedEmail(user, until);
  await grantReferralReward(user.id);
  return true;
}

export type HandleResult = "ativado" | "sem-conta" | "estornado" | "cancelamento" | "ja-processado" | "ignorado";

/** Registra o aviso da plataforma e aplica no plano. Repetições do mesmo aviso não fazem nada. */
export async function handleExternalEvent(event: ExternalEvent): Promise<HandleResult> {
  const db = getDb();
  const rowId = crypto.randomUUID();
  const inserted = await db
    .insert(externalPayments)
    .values({
      id: rowId,
      provider: event.provider,
      externalId: event.externalId.slice(0, 120),
      event: event.event.slice(0, 60),
      status: event.status.slice(0, 40),
      email: normalizeEmail(event.email).slice(0, 200),
      amountCents: event.amountCents,
      months: event.months,
    })
    .onConflictDoNothing()
    .returning({ id: externalPayments.id });
  if (inserted.length === 0) return "ja-processado";

  const user = await findUser(event);

  if (event.kind === "pagamento") {
    if (!user) return "sem-conta";
    return (await activate(user, event, rowId)) ? "ativado" : "ja-processado";
  }

  if (event.kind === "reembolso") {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, `${event.provider}:${event.externalId}`))
      .limit(1);
    await db
      .update(externalPayments)
      .set({ handledAt: new Date().toISOString(), userId: payment?.userId ?? user?.id ?? null })
      .where(eq(externalPayments.id, rowId));
    if (!payment || payment.status === "estornado") return "ignorado";
    await db.update(payments).set({ status: "estornado" }).where(eq(payments.id, payment.id));
    const [owner] = await db.select().from(users).where(eq(users.id, payment.userId)).limit(1);
    if (owner?.plan === "pro" && owner.planExpiresAt) {
      const today = todayISO();
      const reduced = addMonthsToDate(owner.planExpiresAt, -payment.months);
      await db
        .update(users)
        .set({ planExpiresAt: reduced > today ? reduced : today })
        .where(eq(users.id, owner.id));
      await notify(owner.id, {
        type: "pro",
        title: "Pagamento do Pro estornado",
        body: "O valor foi devolvido e o período correspondente saiu do seu plano.",
        href: `${APP_PATH}/plano`,
      });
    }
    // Indicação: estorno do pagamento do convidado desfaz o mês de presente de quem convidou.
    await revokeReferralReward(payment.userId);
    return "estornado";
  }

  // Cancelamento da assinatura: o Pro continua até o fim do período já pago.
  await db
    .update(externalPayments)
    .set({ handledAt: new Date().toISOString(), userId: user?.id ?? null })
    .where(eq(externalPayments.id, rowId));
  if (user) {
    await notify(user.id, {
      type: "pro",
      title: "Assinatura do Pro cancelada",
      body: user.planExpiresAt
        ? `Seu Pro continua ativo até ${user.planExpiresAt.split("-").reverse().join("/")}. Você pode voltar quando quiser.`
        : "Você pode voltar quando quiser.",
      href: `${APP_PATH}/plano`,
    });
  }
  return "cancelamento";
}

/** Pagamentos aprovados que não encontraram conta (para o admin vincular). */
export async function unmatchedPayments() {
  return getDb()
    .select()
    .from(externalPayments)
    .where(and(isNull(externalPayments.userId), isNull(externalPayments.handledAt)))
    .limit(50);
}

/** Vincula um pagamento sem conta a uma pessoa (pelo admin ou pela própria pessoa com o número do pedido). */
export async function assignExternalPayment(paymentRowId: string, user: User): Promise<boolean> {
  const db = getDb();
  const [row] = await db.select().from(externalPayments).where(eq(externalPayments.id, paymentRowId)).limit(1);
  if (!row || row.userId || row.handledAt || row.months <= 0) return false;
  return activate(
    user,
    {
      provider: row.provider as Provider,
      externalId: row.externalId,
      event: row.event,
      kind: "pagamento",
      status: row.status,
      email: row.email,
      amountCents: row.amountCents,
      months: row.months,
    },
    row.id,
  );
}
