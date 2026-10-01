// Venda automática do plano Pro pelo Mercado Pago (Checkout Pro: Pix, cartão e boleto).
// Ativa quando a variável MERCADOPAGO_ACCESS_TOKEN existe. Sem ela, a página de planos
// continua oferecendo a assinatura pelo WhatsApp.
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { payments, users, type User } from "@/db/schema";
import { notify } from "./activity";
import { APP_PATH, PRO_PRICE_CENTS, PRO_YEARLY_PRICE_CENTS } from "./config";
import { addMonthsToDate, todayISO } from "./dates";
import { readEnv } from "./email";
import { sendProActivatedEmail } from "./notifications";
import { grantReferralReward } from "./referral";

export const PRO_PLANS = {
  mensal: { months: 1, priceCents: PRO_PRICE_CENTS, title: "Recebi Pro — 1 mês" },
  anual: { months: 12, priceCents: PRO_YEARLY_PRICE_CENTS, title: "Recebi Pro — 12 meses" },
} as const;

export type ProPlanKey = keyof typeof PRO_PLANS;

const API = "https://api.mercadopago.com";

export function billingEnabled(): boolean {
  return !!readEnv("MERCADOPAGO_ACCESS_TOKEN");
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${readEnv("MERCADOPAGO_ACCESS_TOKEN")}`, "Content-Type": "application/json" };
}

/** Soma meses ao plano Pro a partir da validade atual (se ainda estiver valendo) ou de hoje. */
export async function extendPro(user: Pick<User, "id" | "plan" | "planExpiresAt">, months: number): Promise<string> {
  const today = todayISO();
  const base = user.plan === "pro" && user.planExpiresAt && user.planExpiresAt > today ? user.planExpiresAt : today;
  const expires = addMonthsToDate(base, months);
  await getDb().update(users).set({ plan: "pro", planExpiresAt: expires }).where(eq(users.id, user.id));
  return expires;
}

/** Cria o checkout e devolve o link de pagamento do Mercado Pago. */
export async function createCheckout(user: Pick<User, "id" | "email" | "name">, plan: ProPlanKey, origin: string): Promise<string | null> {
  const selected = PRO_PLANS[plan];
  const response = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: { ...authHeaders(), "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      items: [{ id: `recebi-pro-${plan}`, title: selected.title, quantity: 1, currency_id: "BRL", unit_price: selected.priceCents / 100 }],
      payer: { email: user.email, name: user.name },
      external_reference: `${user.id}:${plan}`,
      back_urls: {
        success: `${origin}${APP_PATH}/plano?pagamento=aprovado`,
        pending: `${origin}${APP_PATH}/plano?pagamento=pendente`,
        failure: `${origin}${APP_PATH}/plano?pagamento=falhou`,
      },
      auto_return: "approved",
      notification_url: `${origin}/recebi/api/mercadopago`,
      statement_descriptor: "RECEBI",
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { init_point?: string };
  return data.init_point ?? null;
}

type MercadoPagoPayment = { id: number; status: string; external_reference?: string; transaction_amount?: number };

/**
 * Confere um pagamento direto na API do Mercado Pago e, se aprovado, libera o Pro.
 * É idempotente: o mesmo pagamento nunca é contado duas vezes.
 */
export async function processPayment(
  paymentId: string,
  expectedUserId?: string,
): Promise<"ativado" | "ja-processado" | "pendente" | "invalido"> {
  if (!billingEnabled() || !/^\d{1,20}$/.test(paymentId)) return "invalido";
  const response = await fetch(`${API}/v1/payments/${paymentId}`, { headers: authHeaders() });
  if (!response.ok) return "invalido";
  const payment = (await response.json()) as MercadoPagoPayment;

  const [userId, planKey] = (payment.external_reference ?? "").split(":");
  const plan = PRO_PLANS[planKey as ProPlanKey];
  if (!userId || !plan) return "invalido";
  if (expectedUserId && expectedUserId !== userId) return "invalido";
  if (payment.status !== "approved") return "pendente";
  if (Math.round((payment.transaction_amount ?? 0) * 100) < plan.priceCents) return "invalido";

  const db = getDb();
  const inserted = await db
    .insert(payments)
    .values({ id: String(payment.id), userId, status: payment.status, amountCents: plan.priceCents, months: plan.months })
    .onConflictDoNothing()
    .returning({ id: payments.id });
  if (inserted.length === 0) return "ja-processado";

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return "invalido";
  const until = await extendPro(user, plan.months);
  await notify(user.id, {
    type: "pro",
    title: "Seu plano Pro está ativo ✨",
    body: `Pagamento confirmado. Válido até ${until.split("-").reverse().join("/")}.`,
    href: "/recebi/painel/plano",
  });
  await sendProActivatedEmail(user, until);
  await grantReferralReward(user.id);
  return "ativado";
}

/** Valida a assinatura (x-signature) das notificações do Mercado Pago, quando o segredo está configurado. */
export async function verifyWebhookSignature(request: Request, dataId: string): Promise<boolean> {
  const secret = readEnv("MERCADOPAGO_WEBHOOK_SECRET");
  if (!secret) return true;
  const signature = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return hex === parts.v1;
}
