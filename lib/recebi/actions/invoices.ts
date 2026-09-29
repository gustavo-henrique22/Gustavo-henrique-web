"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { clients, invoiceItems, invoices, projects, transactions } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { hasPro, requireUser } from "../auth";
import { INCOME_CATEGORIES } from "../categories";
import { APP_PATH, FREE_LIMITS } from "../config";
import { countInvoicesInMonth } from "../data";
import { currentMonth, isValidISODate, todayISO } from "../dates";
import { randomToken } from "../crypto";
import { parseMoney } from "../money";

const MAX_ITEMS = 30;

function refresh() {
  revalidatePath(APP_PATH, "layout");
}

async function findInvoice(userId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(invoices)
    .where(and(eq(invoices.userId, userId), eq(invoices.id, id)))
    .limit(1);
  return row ?? null;
}

type ParsedItem = { description: string; quantity: number; unitPriceCents: number };

function parseItems(formData: FormData): ParsedItem[] | string {
  const descriptions = formData.getAll("itemDescription").map((v) => String(v).trim().slice(0, 200));
  const quantities = formData.getAll("itemQuantity").map((v) => String(v).trim());
  const prices = formData.getAll("itemPrice").map((v) => String(v).trim());
  const items: ParsedItem[] = [];

  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i];
    const priceText = prices[i] ?? "";
    if (!description && !priceText) continue; // linha em branco
    if (!description) return `Descreva o item ${i + 1}.`;
    const quantity = Number((quantities[i] || "1").replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) return `Quantidade inválida no item ${i + 1}.`;
    const unitPriceCents = parseMoney(priceText);
    if (unitPriceCents === null || unitPriceCents <= 0) return `Informe o valor do item ${i + 1}.`;
    items.push({ description, quantity: Math.round(quantity * 100) / 100, unitPriceCents });
  }
  if (items.length === 0) return "Adicione pelo menos um item à cobrança.";
  if (items.length > MAX_ITEMS) return `Use no máximo ${MAX_ITEMS} itens.`;
  return items;
}

export async function saveInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const intent = text(formData, "intent");
  const issueDate = text(formData, "issueDate", 10);
  const dueDate = text(formData, "dueDate", 10);
  const notes = text(formData, "notes", 2000);
  const discountInput = text(formData, "discount", 30);
  const discountCents = discountInput ? parseMoney(discountInput) : 0;

  if (!isValidISODate(issueDate)) return fail("Informe a data de emissão.");
  if (!isValidISODate(dueDate)) return fail("Informe a data de vencimento.");
  if (dueDate < issueDate) return fail("O vencimento não pode ser antes da emissão.");
  if (discountCents === null || discountCents < 0) return fail("Desconto inválido.");

  const items = parseItems(formData);
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
  if (!client) return fail("Escolha para qual cliente é a cobrança.");

  const values = {
    clientId: client.id,
    projectId: project?.id ?? null,
    issueDate,
    dueDate,
    notes,
    discountCents,
    totalCents,
  };

  let invoiceId = id;
  if (id) {
    const existing = await findInvoice(user.id, id);
    if (!existing) return fail("Cobrança não encontrada.");
    if (existing.status === "paga") return fail("Esta cobrança já foi paga e não pode mais ser editada.");
    await db
      .update(invoices)
      .set({ ...values, status: intent === "enviar" && existing.status === "rascunho" ? "enviada" : existing.status })
      .where(eq(invoices.id, id));
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  } else {
    if (!hasPro(user) && (await countInvoicesInMonth(user.id, currentMonth())) >= FREE_LIMITS.invoicesPerMonth) {
      return fail(`O plano Grátis permite ${FREE_LIMITS.invoicesPerMonth} cobranças por mês. Conheça o Pro para cobranças ilimitadas.`);
    }
    invoiceId = crypto.randomUUID();
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${invoices.number}), 0) + 1` })
      .from(invoices)
      .where(eq(invoices.userId, user.id));
    await db.insert(invoices).values({
      ...values,
      id: invoiceId,
      userId: user.id,
      number: next,
      publicToken: randomToken(18),
      status: intent === "enviar" ? "enviada" : "rascunho",
    });
  }

  // Itens: 6 colunas por linha; lotes de 10 ficam abaixo do limite de parâmetros do D1.
  const rows = items.map((item, position) => ({ ...item, id: crypto.randomUUID(), invoiceId, position }));
  for (let i = 0; i < rows.length; i += 10) {
    await db.insert(invoiceItems).values(rows.slice(i, i + 10));
  }

  refresh();
  redirect(`${APP_PATH}/cobrancas/${invoiceId}${intent === "enviar" ? "?enviar=1" : ""}`);
}

export async function setInvoiceStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const status = text(formData, "status");
  const invoice = await findInvoice(user.id, id);
  if (!invoice) return fail("Cobrança não encontrada.");
  if (invoice.status === "paga") return fail("Desfaça o pagamento antes de mudar o status.");
  if (status !== "enviada" && status !== "cancelada" && status !== "rascunho") return fail("Status inválido.");

  await getDb().update(invoices).set({ status }).where(eq(invoices.id, id));
  refresh();
  return success(
    status === "enviada"
      ? "Cobrança liberada. Agora é só enviar o link."
      : status === "cancelada"
        ? "Cobrança cancelada."
        : "Cobrança voltou para rascunho.",
  );
}

export async function markInvoicePaid(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const paidAt = text(formData, "paidAt", 10) || todayISO();
  const categoryInput = text(formData, "category", 60);
  const category = (INCOME_CATEGORIES as readonly string[]).includes(categoryInput) ? categoryInput : INCOME_CATEGORIES[0];
  if (!isValidISODate(paidAt)) return fail("Data de pagamento inválida.");

  const invoice = await findInvoice(user.id, id);
  if (!invoice) return fail("Cobrança não encontrada.");
  if (invoice.status === "paga") return fail("Esta cobrança já está paga.");
  if (invoice.status === "cancelada") return fail("Reative a cobrança antes de marcar como paga.");

  const db = getDb();
  await db.update(invoices).set({ status: "paga", paidAt }).where(eq(invoices.id, id));
  await db.insert(transactions).values({
    id: crypto.randomUUID(),
    userId: user.id,
    type: "receita",
    description: `Cobrança #${String(invoice.number).padStart(4, "0")}`,
    amountCents: invoice.totalCents,
    category,
    date: paidAt,
    status: "pago",
    clientId: invoice.clientId,
    projectId: invoice.projectId,
    invoiceId: invoice.id,
  });
  refresh();
  return success("Pagamento registrado! A receita já entrou nos seus lançamentos.");
}

export async function undoInvoicePayment(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const invoice = await findInvoice(user.id, id);
  if (!invoice || invoice.status !== "paga") return fail("Esta cobrança não está paga.");

  const db = getDb();
  await db.update(invoices).set({ status: "enviada", paidAt: null }).where(eq(invoices.id, id));
  await db.delete(transactions).where(and(eq(transactions.userId, user.id), eq(transactions.invoiceId, id)));
  refresh();
  return success("Pagamento desfeito e receita removida dos lançamentos.");
}

export async function deleteInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const invoice = await findInvoice(user.id, id);
  if (!invoice) return fail("Cobrança não encontrada.");
  await getDb().delete(invoices).where(eq(invoices.id, id));
  refresh();
  redirect(`${APP_PATH}/cobrancas`);
}

export async function duplicateInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const invoice = await findInvoice(user.id, id);
  if (!invoice) return fail("Cobrança não encontrada.");
  if (!hasPro(user) && (await countInvoicesInMonth(user.id, currentMonth())) >= FREE_LIMITS.invoicesPerMonth) {
    return fail(`O plano Grátis permite ${FREE_LIMITS.invoicesPerMonth} cobranças por mês.`);
  }

  const db = getDb();
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${invoices.number}), 0) + 1` })
    .from(invoices)
    .where(eq(invoices.userId, user.id));
  const newId = crypto.randomUUID();
  const today = todayISO();
  const dueOffsetDays = Math.max(
    0,
    Math.round((Date.parse(`${invoice.dueDate}T00:00:00Z`) - Date.parse(`${invoice.issueDate}T00:00:00Z`)) / 86_400_000),
  );
  const due = new Date(Date.parse(`${today}T00:00:00Z`) + dueOffsetDays * 86_400_000).toISOString().slice(0, 10);

  await db.insert(invoices).values({
    id: newId,
    userId: user.id,
    clientId: invoice.clientId,
    projectId: invoice.projectId,
    number: next,
    publicToken: randomToken(18),
    status: "rascunho",
    issueDate: today,
    dueDate: due,
    discountCents: invoice.discountCents,
    totalCents: invoice.totalCents,
    notes: invoice.notes,
  });
  const copies = items.map((item) => ({ ...item, id: crypto.randomUUID(), invoiceId: newId }));
  for (let i = 0; i < copies.length; i += 10) {
    await db.insert(invoiceItems).values(copies.slice(i, i + 10));
  }
  refresh();
  redirect(`${APP_PATH}/cobrancas/${newId}/editar`);
}
