"use server";

import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { clients, projects, quoteItems, quoteRequests, quotes } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { hasPro, requireUser } from "../auth";
import { APP_PATH, BASE_PATH, FREE_LIMITS } from "../config";
import { countQuotesInMonth } from "../data";
import { addDays, currentMonth, isValidISODate, todayISO } from "../dates";
import { randomToken } from "../crypto";
import { createInvoice, nextQuoteNumber, parseItems } from "../documents";
import { logEvent, notify, requestIp } from "../activity";
import { formatMoney, parseMoney } from "../money";
import { notifyQuoteDecision, sendQuoteEmail } from "../notifications";
import { takeRateLimit } from "../rate-limit";

const PAYMENT_TERMS = [0, 3, 7, 10, 15, 30];

function refresh() {
  revalidatePath(APP_PATH, "layout");
}

async function findQuote(userId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(quotes)
    .where(and(eq(quotes.userId, userId), eq(quotes.id, id)))
    .limit(1);
  return row ?? null;
}

async function insertQuoteItems(quoteId: string, items: { description: string; quantity: number; unitPriceCents: number }[]) {
  const db = getDb();
  const rows = items.map((item, position) => ({ ...item, id: crypto.randomUUID(), quoteId, position }));
  for (let i = 0; i < rows.length; i += 10) {
    await db.insert(quoteItems).values(rows.slice(i, i + 10));
  }
}

export async function saveQuote(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const intent = text(formData, "intent");
  const issueDate = text(formData, "issueDate", 10);
  const validUntil = text(formData, "validUntil", 10);
  const notes = text(formData, "notes", 2000);
  const discountInput = text(formData, "discount", 30);
  const discountCents = discountInput ? parseMoney(discountInput) : 0;
  const termInput = Number(text(formData, "paymentTermDays", 3));
  const paymentTermDays = PAYMENT_TERMS.includes(termInput) ? termInput : 7;

  if (!isValidISODate(issueDate)) return fail("Informe a data de emissão.");
  if (!isValidISODate(validUntil)) return fail("Informe até quando o orçamento vale.");
  if (validUntil < issueDate) return fail("A validade não pode ser antes da emissão.");
  if (discountCents === null || discountCents < 0) return fail("Desconto inválido.");

  const items = parseItems(formData, "ao orçamento");
  if (typeof items === "string") return fail(items);
  const subtotal = items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0);
  const totalCents = subtotal - discountCents;
  if (totalCents <= 0) return fail("O total precisa ser maior que zero.");

  const db = getDb();
  const clientIdInput = text(formData, "clientId", 64);
  const projectIdInput = text(formData, "projectId", 64);
  const [client] = clientIdInput
    ? await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.userId, user.id), eq(clients.id, clientIdInput)))
        .limit(1)
    : [];
  const [project] = projectIdInput
    ? await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.userId, user.id), eq(projects.id, projectIdInput)))
        .limit(1)
    : [];
  if (!client) return fail("Escolha para qual cliente é o orçamento.");

  const values = {
    clientId: client.id,
    projectId: project?.id ?? null,
    issueDate,
    validUntil,
    paymentTermDays,
    notes,
    discountCents,
    totalCents,
  };

  let quoteId = id;
  let previousStatus: string | null = null;
  if (id) {
    const existing = await findQuote(user.id, id);
    if (!existing) return fail("Orçamento não encontrado.");
    if (existing.status === "aprovado") return fail("Este orçamento já foi aprovado e não pode mais ser editado.");
    previousStatus = existing.status;
    // Editar um orçamento recusado o reenvia para o cliente decidir de novo.
    const status = intent === "enviar" || existing.status === "recusado" ? "enviado" : existing.status;
    await db
      .update(quotes)
      .set({
        ...values,
        status,
        decidedAt: status === "enviado" ? null : existing.decidedAt,
        decisionNote: status === "enviado" ? "" : existing.decisionNote,
      })
      .where(eq(quotes.id, id));
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));
  } else {
    if (!hasPro(user) && (await countQuotesInMonth(user.id, currentMonth())) >= FREE_LIMITS.quotesPerMonth) {
      return fail(`O plano Grátis permite ${FREE_LIMITS.quotesPerMonth} orçamentos por mês. Conheça o Pro para orçamentos ilimitados.`);
    }
    quoteId = crypto.randomUUID();
    await db.insert(quotes).values({
      ...values,
      id: quoteId,
      userId: user.id,
      number: await nextQuoteNumber(user.id),
      publicToken: randomToken(18),
      status: intent === "enviar" ? "enviado" : "rascunho",
    });
  }
  await insertQuoteItems(quoteId, items);
  if (!previousStatus) await logEvent(user.id, "orcamento", quoteId, "criado");
  const requestId = text(formData, "requestId", 64);
  if (!id && requestId) {
    const answered = await db
      .update(quoteRequests)
      .set({ status: "respondido" })
      .where(and(eq(quoteRequests.id, requestId), eq(quoteRequests.userId, user.id)))
      .returning({ name: quoteRequests.name });
    if (answered.length > 0) await logEvent(user.id, "orcamento", quoteId, "pedido-site", `Pedido de ${answered[0].name}`);
  }
  const nowSent = intent === "enviar" || previousStatus === "recusado" || previousStatus === "enviado";
  if (nowSent && previousStatus !== "enviado") await logEvent(user.id, "orcamento", quoteId, "enviado");

  refresh();
  redirect(`${APP_PATH}/orcamentos/${quoteId}${intent === "enviar" ? "?enviar=1" : ""}`);
}

export async function setQuoteStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const status = text(formData, "status");
  const quote = await findQuote(user.id, id);
  if (!quote) return fail("Orçamento não encontrado.");
  if (quote.status === "aprovado") return fail("Este orçamento já foi aprovado.");
  if (status !== "enviado" && status !== "rascunho") return fail("Status inválido.");
  await getDb().update(quotes).set({ status, decidedAt: null, decisionNote: "" }).where(eq(quotes.id, id));
  if (status === "enviado") await logEvent(user.id, "orcamento", id, "enviado");
  refresh();
  return success(status === "enviado" ? "Orçamento liberado. Agora é só enviar o link." : "Orçamento voltou para rascunho.");
}

/** Aprova o orçamento e cria a cobrança correspondente. Usado pelo cliente (link) e pelo freelancer. */
async function approve(quote: typeof quotes.$inferSelect, acceptance: { name: string; ip: string } | null) {
  const db = getDb();
  // Marca como aprovado só se ainda não estava: evita duas cobranças com clique duplo.
  const claimed = await db
    .update(quotes)
    .set({
      status: "aprovado",
      decidedAt: new Date().toISOString(),
      acceptedName: acceptance?.name ?? null,
      acceptedIp: acceptance?.ip ?? null,
    })
    .where(and(eq(quotes.id, quote.id), ne(quotes.status, "aprovado")))
    .returning({ id: quotes.id });
  if (claimed.length === 0) return null;

  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id)).orderBy(asc(quoteItems.position));
  const today = todayISO();
  const invoice = await createInvoice({
    userId: quote.userId,
    clientId: quote.clientId,
    projectId: quote.projectId,
    status: "enviada",
    issueDate: today,
    dueDate: addDays(today, quote.paymentTermDays),
    discountCents: quote.discountCents,
    notes: quote.notes,
    items,
  });
  await db.update(quotes).set({ invoiceId: invoice.id }).where(eq(quotes.id, quote.id));

  const quoteNumber = String(quote.number).padStart(4, "0");
  const invoiceNumber = String(invoice.number).padStart(4, "0");
  await logEvent(
    quote.userId,
    "orcamento",
    quote.id,
    acceptance ? "aprovado" : "aprovado-manual",
    acceptance ? `Aceite eletrônico de ${acceptance.name}` : "",
  );
  await logEvent(quote.userId, "orcamento", quote.id, "convertido", `Cobrança #${invoiceNumber}`);
  await logEvent(quote.userId, "cobranca", invoice.id, "criado", `A partir do orçamento #${quoteNumber}`);
  return invoice;
}

async function clientNameOf(clientId: string | null): Promise<string> {
  if (!clientId) return "Seu cliente";
  const [row] = await getDb().select({ name: clients.name }).from(clients).where(eq(clients.id, clientId)).limit(1);
  return row?.name ?? "Seu cliente";
}

export async function approveQuoteAsOwner(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const quote = await findQuote(user.id, text(formData, "id", 64));
  if (!quote) return fail("Orçamento não encontrado.");
  if (quote.status === "aprovado") return fail("Este orçamento já foi aprovado.");
  const invoice = await approve(quote, null);
  if (!invoice) return fail("Este orçamento já foi aprovado.");
  refresh();
  redirect(`${APP_PATH}/cobrancas/${invoice.id}?enviar=1`);
}

async function findPublicQuote(token: string) {
  const [row] = await getDb()
    .select()
    .from(quotes)
    .where(and(eq(quotes.publicToken, token), isNull(quotes.linkDisabledAt)))
    .limit(1);
  return row ?? null;
}

/** Ação pública: o cliente aprova pelo link. */
/** Limite das respostas pelo link público (por conexão), contra robôs. */
async function publicLinkAllowed(): Promise<boolean> {
  const ip = await requestIp();
  return !ip || (await takeRateLimit(`link-publico:${ip}`, 30, 3_600_000));
}

export async function approveQuoteByClient(_: ActionState, formData: FormData): Promise<ActionState> {
  const token = text(formData, "token", 64);
  if (!(await publicLinkAllowed())) return fail("Muitas tentativas. Tente de novo em uma hora.");
  const quote = await findPublicQuote(token);
  if (!quote || quote.status === "rascunho") return fail("Orçamento não encontrado.");
  if (quote.status === "aprovado") return fail("Este orçamento já foi aprovado.");
  if (quote.status === "recusado") return fail("Este orçamento foi recusado. Peça uma nova versão.");
  if (quote.validUntil < todayISO()) return fail("Este orçamento expirou. Peça uma nova versão.");
  const acceptedName = text(formData, "acceptedName", 120);
  if (acceptedName.length < 3) return fail("Digite seu nome completo para aprovar.");
  if (formData.get("accept") !== "on") return fail("Confirme que leu e aceita as condições do orçamento.");

  const invoice = await approve(quote, { name: acceptedName, ip: await requestIp() });
  if (!invoice) return fail("Este orçamento já foi aprovado.");
  await notify(quote.userId, {
    type: "aprovado",
    title: `🎉 ${await clientNameOf(quote.clientId)} aprovou o orçamento #${String(quote.number).padStart(4, "0")}`,
    body: `A cobrança de ${formatMoney(quote.totalCents)} já foi criada e enviada.`,
    href: `${APP_PATH}/cobrancas/${invoice.id}`,
  });
  await notifyQuoteDecision(quote.id, "aprovado");
  revalidatePath(APP_PATH, "layout");
  redirect(`${BASE_PATH}/c/${invoice.publicToken}?aprovado=1`);
}

/** Ação pública: o cliente recusa pelo link, com um comentário opcional. */
export async function rejectQuoteByClient(_: ActionState, formData: FormData): Promise<ActionState> {
  const token = text(formData, "token", 64);
  const note = text(formData, "note", 500);
  if (!(await publicLinkAllowed())) return fail("Muitas tentativas. Tente de novo em uma hora.");
  const quote = await findPublicQuote(token);
  if (!quote || quote.status !== "enviado") return fail("Este orçamento não está aguardando resposta.");

  // Só recusa se ainda estiver aguardando: não sobrescreve uma aprovação feita ao mesmo tempo.
  const rejected = await getDb()
    .update(quotes)
    .set({ status: "recusado", decidedAt: new Date().toISOString(), decisionNote: note })
    .where(and(eq(quotes.id, quote.id), eq(quotes.status, "enviado")))
    .returning({ id: quotes.id });
  if (rejected.length === 0) return fail("Este orçamento não está aguardando resposta.");
  await logEvent(quote.userId, "orcamento", quote.id, "recusado", note);
  await notify(quote.userId, {
    type: "recusado",
    title: `${await clientNameOf(quote.clientId)} recusou o orçamento #${String(quote.number).padStart(4, "0")}`,
    body: note ? `“${note}”` : "O cliente não deixou comentário.",
    href: `${APP_PATH}/orcamentos/${quote.id}`,
  });
  await notifyQuoteDecision(quote.id, "recusado");
  revalidatePath(APP_PATH, "layout");
  return success("Resposta enviada. Obrigado!");
}

export async function deleteQuote(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const quote = await findQuote(user.id, text(formData, "id", 64));
  if (!quote) return fail("Orçamento não encontrado.");
  await getDb().delete(quotes).where(eq(quotes.id, quote.id));
  refresh();
  redirect(`${APP_PATH}/orcamentos`);
}

export async function duplicateQuote(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const quote = await findQuote(user.id, text(formData, "id", 64));
  if (!quote) return fail("Orçamento não encontrado.");
  if (!hasPro(user) && (await countQuotesInMonth(user.id, currentMonth())) >= FREE_LIMITS.quotesPerMonth) {
    return fail(`O plano Grátis permite ${FREE_LIMITS.quotesPerMonth} orçamentos por mês.`);
  }
  const db = getDb();
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id)).orderBy(asc(quoteItems.position));
  const today = todayISO();
  const newId = crypto.randomUUID();
  await db.insert(quotes).values({
    id: newId,
    userId: user.id,
    clientId: quote.clientId,
    projectId: quote.projectId,
    number: await nextQuoteNumber(user.id),
    publicToken: randomToken(18),
    status: "rascunho",
    issueDate: today,
    validUntil: addDays(today, 15),
    paymentTermDays: quote.paymentTermDays,
    discountCents: quote.discountCents,
    totalCents: quote.totalCents,
    notes: quote.notes,
  });
  await insertQuoteItems(newId, items);
  await logEvent(user.id, "orcamento", newId, "criado", `Cópia do orçamento #${String(quote.number).padStart(4, "0")}`);
  refresh();
  redirect(`${APP_PATH}/orcamentos/${newId}/editar`);
}

export async function emailQuote(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const quote = await findQuote(user.id, text(formData, "id", 64));
  if (!quote) return fail("Orçamento não encontrado.");
  if (quote.status !== "enviado") return fail("Só é possível enviar orçamentos liberados e aguardando resposta.");
  const ok = await sendQuoteEmail(user.id, quote.id);
  if (ok) await logEvent(user.id, "orcamento", quote.id, "email");
  return ok
    ? success("Orçamento enviado por e-mail ao cliente.")
    : fail("Não foi possível enviar. Confira se o cliente tem e-mail cadastrado.");
}
