// Partes comuns de cobranças e orçamentos (itens, numeração e criação de cobrança).
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { invoiceItems, invoices, quotes } from "@/db/schema";
import { randomToken } from "./crypto";
import { parseMoney } from "./money";

export const MAX_ITEMS = 30;

export type ParsedItem = { description: string; quantity: number; unitPriceCents: number };

/** Lê as linhas de itens do formulário. Devolve uma mensagem de erro quando algo está inválido. */
export function parseItems(formData: FormData, noun = "à cobrança"): ParsedItem[] | string {
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
  if (items.length === 0) return `Adicione pelo menos um item ${noun}.`;
  if (items.length > MAX_ITEMS) return `Use no máximo ${MAX_ITEMS} itens.`;
  return items;
}

export function itemsSubtotal(items: Pick<ParsedItem, "quantity" | "unitPriceCents">[]): number {
  return items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0);
}

export async function nextInvoiceNumber(userId: string): Promise<number> {
  const [{ next }] = await getDb()
    .select({ next: sql<number>`coalesce(max(${invoices.number}), 0) + 1` })
    .from(invoices)
    .where(eq(invoices.userId, userId));
  return next;
}

export async function nextQuoteNumber(userId: string): Promise<number> {
  const [{ next }] = await getDb()
    .select({ next: sql<number>`coalesce(max(${quotes.number}), 0) + 1` })
    .from(quotes)
    .where(eq(quotes.userId, userId));
  return next;
}

/** Cria uma cobrança com itens. Usada ao duplicar cobranças e quando um orçamento é aprovado. */
export async function createInvoice(input: {
  userId: string;
  clientId: string | null;
  projectId: string | null;
  status: "rascunho" | "enviada";
  issueDate: string;
  dueDate: string;
  discountCents: number;
  notes: string;
  items: ParsedItem[];
}): Promise<{ id: string; publicToken: string; number: number }> {
  const db = getDb();
  const id = crypto.randomUUID();
  const publicToken = randomToken(18);
  const number = await nextInvoiceNumber(input.userId);
  await db.insert(invoices).values({
    id,
    userId: input.userId,
    clientId: input.clientId,
    projectId: input.projectId,
    number,
    publicToken,
    status: input.status,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    discountCents: input.discountCents,
    totalCents: itemsSubtotal(input.items) - input.discountCents,
    notes: input.notes,
  });
  const rows = input.items.map((item, position) => ({
    id: crypto.randomUUID(),
    invoiceId: id,
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    position,
  }));
  // Lotes de 10 linhas ficam abaixo do limite de parâmetros por consulta do D1.
  for (let i = 0; i < rows.length; i += 10) {
    await db.insert(invoiceItems).values(rows.slice(i, i + 10));
  }
  return { id, publicToken, number };
}
