// E-mails automáticos do Recebi. Todas as funções são silenciosas quando o
// envio de e-mails não está configurado.
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, invoiceReminders, invoices, loginAttempts, quotes, users, type User } from "@/db/schema";
import { logEvent } from "./activity";
import { APP_PATH, BASE_PATH } from "./config";
import { addDays, daysBetween, formatDate, todayISO } from "./dates";
import { emailEnabled, emailLayout, escapeHtml, sendEmail } from "./email";
import { formatMoney } from "./money";
import { siteOrigin } from "./origin";

const pad = (n: number) => String(n).padStart(4, "0");
const REMINDER_LABELS = {
  antes: "3 dias antes do vencimento",
  vencimento: "No dia do vencimento",
  atraso: "3 dias após o vencimento",
} as const;

/** Limite diário de e-mails para clientes, por freelancer (evita uso do Recebi para spam). */
async function reserveClientEmail(owner: Pick<User, "id" | "isDemo" | "plan" | "planExpiresAt">): Promise<boolean> {
  if (owner.isDemo) return false;
  const db = getDb();
  const key = `email:${owner.id}`;
  const since = new Date(Date.now() - 86_400_000).toISOString().replace("T", " ").slice(0, 19);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, key), gte(loginAttempts.createdAt, since)));
  const pro = owner.plan === "pro" && (!owner.planExpiresAt || owner.planExpiresAt >= todayISO());
  if (count >= (pro ? 60 : 15)) return false;
  await db.insert(loginAttempts).values({ id: crypto.randomUUID(), email: key });
  return true;
}
const ownerName = (u: Pick<User, "name" | "businessName">) => u.businessName || u.name;

export async function sendWelcomeEmail(user: Pick<User, "name" | "email">) {
  if (!emailEnabled()) return;
  const origin = await siteOrigin();
  await sendEmail({
    to: user.email,
    subject: "Boas-vindas ao Recebi 🎉",
    html: emailLayout({
      preheader: "Sua conta está pronta. Veja como começar em 5 minutos.",
      title: `Que bom ter você aqui, ${escapeHtml(user.name.split(" ")[0])}!`,
      paragraphs: [
        "Sua conta no Recebi está pronta. Em poucos minutos você organiza suas finanças de freelancer:",
        "1. Cadastre sua <strong>chave Pix</strong> em Configurações.<br>2. Adicione seus <strong>clientes</strong>.<br>3. Envie um <strong>orçamento</strong> ou uma <strong>cobrança</strong> com link.",
      ],
      cta: { label: "Abrir meu painel", url: `${origin}${APP_PATH}` },
    }),
  });
}

export async function sendPasswordResetEmail(user: Pick<User, "name" | "email">, link: string) {
  return sendEmail({
    to: user.email,
    subject: "Redefinir sua senha do Recebi",
    html: emailLayout({
      preheader: "Link para criar uma nova senha (válido por 24 horas).",
      title: "Vamos criar uma nova senha?",
      paragraphs: [
        `Olá, ${escapeHtml(user.name.split(" ")[0])}! Recebemos um pedido para redefinir sua senha.`,
        "O link vale por 24 horas. Se não foi você, ignore este e-mail.",
      ],
      cta: { label: "Criar nova senha", url: link },
    }),
  });
}

/** Envia a cobrança por e-mail para o cliente. Devolve false se não foi possível. */
export async function sendInvoiceEmail(userId: string, invoiceId: string, kind: "nova" | "antes" | "vencimento" | "atraso" = "nova") {
  if (!emailEnabled()) return false;
  const [row] = await getDb()
    .select({ invoice: invoices, client: clients, owner: users })
    .from(invoices)
    .innerJoin(users, eq(users.id, invoices.userId))
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
    .limit(1);
  if (!row?.client?.email || row.invoice.status !== "enviada" || !(await reserveClientEmail(row.owner))) return false;
  const { invoice, client, owner } = row;
  const origin = await siteOrigin();
  const name = ownerName(owner);
  const titles = {
    nova: `${name} enviou uma cobrança para você`,
    antes: `Lembrete: cobrança vence em ${formatDate(invoice.dueDate)}`,
    vencimento: "Lembrete: a cobrança vence hoje",
    atraso: "A cobrança está em atraso",
  } as const;
  const subjects = {
    nova: `Cobrança #${pad(invoice.number)} de ${name}`,
    antes: `Lembrete: cobrança #${pad(invoice.number)} vence em breve`,
    vencimento: `A cobrança #${pad(invoice.number)} vence hoje`,
    atraso: `Cobrança #${pad(invoice.number)} em atraso`,
  } as const;
  return sendEmail({
    to: client.email,
    replyTo: owner.email,
    fromName: name,
    subject: subjects[kind],
    html: emailLayout({
      preheader: `${formatMoney(invoice.totalCents)} · vencimento ${formatDate(invoice.dueDate)}`,
      title: titles[kind],
      paragraphs: [
        `Olá, ${escapeHtml(client.name.split(" ")[0])}!`,
        kind === "atraso"
          ? `A cobrança #${pad(invoice.number)} de <strong>${escapeHtml(name)}</strong> venceu em ${formatDate(invoice.dueDate)}. Se já pagou, pode desconsiderar esta mensagem.`
          : `Segue a cobrança #${pad(invoice.number)} de <strong>${escapeHtml(name)}</strong>, com vencimento em ${formatDate(invoice.dueDate)}. Você pode pagar com Pix direto pelo link.`,
      ],
      highlight: { label: "Valor", value: formatMoney(invoice.totalCents) },
      cta: { label: "Ver cobrança e pagar com Pix", url: `${origin}${BASE_PATH}/c/${invoice.publicToken}` },
      footer: `Dúvidas? É só responder este e-mail para falar com ${escapeHtml(name)}.`,
    }),
  });
}

export async function sendQuoteEmail(userId: string, quoteId: string) {
  if (!emailEnabled()) return false;
  const [row] = await getDb()
    .select({ quote: quotes, client: clients, owner: users })
    .from(quotes)
    .innerJoin(users, eq(users.id, quotes.userId))
    .leftJoin(clients, eq(clients.id, quotes.clientId))
    .where(and(eq(quotes.id, quoteId), eq(quotes.userId, userId)))
    .limit(1);
  if (!row?.client?.email || row.quote.status !== "enviado" || !(await reserveClientEmail(row.owner))) return false;
  const { quote, client, owner } = row;
  const origin = await siteOrigin();
  const name = ownerName(owner);
  return sendEmail({
    to: client.email,
    replyTo: owner.email,
    fromName: name,
    subject: `Orçamento #${pad(quote.number)} de ${name}`,
    html: emailLayout({
      preheader: `${formatMoney(quote.totalCents)} · válido até ${formatDate(quote.validUntil)}`,
      title: `${name} enviou um orçamento para você`,
      paragraphs: [
        `Olá, ${escapeHtml(client.name.split(" ")[0])}!`,
        `Preparei o orçamento #${pad(quote.number)}, válido até ${formatDate(quote.validUntil)}. Você pode ver os detalhes e aprovar com um clique.`,
      ],
      highlight: { label: "Total", value: formatMoney(quote.totalCents) },
      cta: { label: "Ver e aprovar orçamento", url: `${origin}${BASE_PATH}/o/${quote.publicToken}` },
      footer: `Dúvidas? É só responder este e-mail para falar com ${escapeHtml(name)}.`,
    }),
  });
}

/** Avisa o freelancer quando o cliente aprova ou recusa um orçamento. */
export async function notifyQuoteDecision(quoteId: string, decision: "aprovado" | "recusado") {
  if (!emailEnabled()) return;
  const [row] = await getDb()
    .select({ quote: quotes, client: clients, owner: users })
    .from(quotes)
    .innerJoin(users, eq(users.id, quotes.userId))
    .leftJoin(clients, eq(clients.id, quotes.clientId))
    .where(eq(quotes.id, quoteId))
    .limit(1);
  if (!row || row.owner.isDemo) return;
  const { quote, client, owner } = row;
  const origin = await siteOrigin();
  const who = client?.name ?? "Seu cliente";
  await sendEmail({
    to: owner.email,
    subject:
      decision === "aprovado" ? `🎉 ${who} aprovou o orçamento #${pad(quote.number)}` : `${who} recusou o orçamento #${pad(quote.number)}`,
    html: emailLayout({
      preheader: formatMoney(quote.totalCents),
      title: decision === "aprovado" ? "Orçamento aprovado!" : "Orçamento recusado",
      paragraphs:
        decision === "aprovado"
          ? [
              `<strong>${escapeHtml(who)}</strong> aprovou o orçamento #${pad(quote.number)}. A cobrança com Pix já foi criada e está no seu painel.`,
            ]
          : [
              `<strong>${escapeHtml(who)}</strong> recusou o orçamento #${pad(quote.number)}.`,
              quote.decisionNote ? `Comentário do cliente: “${escapeHtml(quote.decisionNote)}”` : "O cliente não deixou comentário.",
            ],
      highlight: { label: "Valor do orçamento", value: formatMoney(quote.totalCents) },
      cta: { label: "Abrir no Recebi", url: `${origin}${APP_PATH}/orcamentos/${quote.id}` },
    }),
  });
}

/** Recibo por e-mail para o cliente depois que a cobrança é marcada como paga. */
export async function sendReceiptEmail(invoiceId: string) {
  if (!emailEnabled()) return false;
  const [row] = await getDb()
    .select({ invoice: invoices, client: clients, owner: users })
    .from(invoices)
    .innerJoin(users, eq(users.id, invoices.userId))
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!row?.client?.email || row.invoice.status !== "paga" || !(await reserveClientEmail(row.owner))) return false;
  const { invoice, client, owner } = row;
  const origin = await siteOrigin();
  const name = ownerName(owner);
  return sendEmail({
    to: client.email,
    replyTo: owner.email,
    fromName: name,
    subject: `Recibo da cobrança #${pad(invoice.number)} — ${name}`,
    html: emailLayout({
      preheader: `Pagamento de ${formatMoney(invoice.totalCents)} confirmado.`,
      title: "Pagamento confirmado. Obrigado!",
      paragraphs: [
        `Olá, ${escapeHtml(client.name.split(" ")[0])}! ${escapeHtml(name)} confirmou o recebimento da cobrança #${pad(invoice.number)} em ${formatDate(invoice.paidAt)}.`,
        "Seu recibo está disponível no link abaixo, pronto para imprimir ou salvar em PDF.",
      ],
      highlight: { label: "Valor pago", value: formatMoney(invoice.totalCents) },
      cta: { label: "Ver recibo", url: `${origin}${BASE_PATH}/c/${invoice.publicToken}/recibo` },
    }),
  });
}

export async function sendProActivatedEmail(user: Pick<User, "name" | "email">, until: string) {
  if (!emailEnabled()) return;
  const origin = await siteOrigin();
  await sendEmail({
    to: user.email,
    subject: "Seu plano Pro está ativo ✨",
    html: emailLayout({
      preheader: `Válido até ${formatDate(until)}.`,
      title: "Bem-vindo ao Recebi Pro!",
      paragraphs: [
        `Obrigado pela confiança, ${escapeHtml(user.name.split(" ")[0])}. Seu plano Pro já está ativo e vale até <strong>${formatDate(until)}</strong>.`,
        "Agora você tem clientes, orçamentos e cobranças ilimitados, relatórios completos, lembretes automáticos, comprovantes anexados e sua logo nas cobranças.",
      ],
      cta: { label: "Aproveitar o Pro", url: `${origin}${APP_PATH}` },
    }),
  });
}

/**
 * Lembretes automáticos de cobrança: 3 dias antes, no dia e 3 dias depois do vencimento.
 * Chamado todos os dias pelo agendador (veja app/recebi/api/lembretes/route.ts).
 * Só vale para freelancers do plano Pro com lembretes ativados.
 */
export async function sendDueReminders(): Promise<{ sent: number; checked: number }> {
  if (!emailEnabled()) return { sent: 0, checked: 0 };
  const db = getDb();
  const today = todayISO();
  const candidates = await db
    .select({ invoice: invoices, owner: users, clientEmail: clients.email })
    .from(invoices)
    .innerJoin(users, eq(users.id, invoices.userId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.status, "enviada"), gte(invoices.dueDate, addDays(today, -3)), lte(invoices.dueDate, addDays(today, 3))))
    .limit(500);

  const eligible = candidates.filter(({ owner, clientEmail }) => {
    const pro = owner.plan === "pro" && (!owner.planExpiresAt || owner.planExpiresAt >= today);
    return pro && owner.autoReminders && !owner.isDemo && !!clientEmail;
  });
  if (eligible.length === 0) return { sent: 0, checked: candidates.length };

  const already = await db
    .select({ invoiceId: invoiceReminders.invoiceId, kind: invoiceReminders.kind })
    .from(invoiceReminders)
    .where(
      inArray(
        invoiceReminders.invoiceId,
        eligible.map((e) => e.invoice.id),
      ),
    );

  let sent = 0;
  for (const { invoice } of eligible) {
    const diff = daysBetween(today, invoice.dueDate);
    const kind = diff === 3 ? "antes" : diff === 0 ? "vencimento" : diff === -3 ? "atraso" : null;
    if (!kind || already.some((a) => a.invoiceId === invoice.id && a.kind === kind)) continue;
    const ok = await sendInvoiceEmail(invoice.userId, invoice.id, kind);
    if (ok) {
      await db.insert(invoiceReminders).values({ id: crypto.randomUUID(), invoiceId: invoice.id, kind }).onConflictDoNothing();
      await logEvent(invoice.userId, "cobranca", invoice.id, "lembrete", REMINDER_LABELS[kind]);
      sent++;
    }
  }
  return { sent, checked: candidates.length };
}
