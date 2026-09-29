"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { categoryRules, clients, invoices, transactions } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { logEvent } from "../activity";
import { hasPro, requireUser } from "../auth";
import { categoriesFor } from "../categories";
import { APP_PATH } from "../config";
import { isValidISODate } from "../dates";
import { MAX_IMPORT_ROWS, matchClient, normalizeText, suggestCategory, type StatementRow } from "../statement";

const MAX_RULES = 100;

function refresh() {
  revalidatePath(APP_PATH, "layout");
}

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function existingExternalIds(userId: string, ids: string[]): Promise<Set<string>> {
  const db = getDb();
  const found = new Set<string>();
  for (const part of chunk(ids, 90)) {
    const rows = await db
      .select({ externalId: transactions.externalId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.externalId, part)));
    rows.forEach((r) => r.externalId && found.add(r.externalId));
  }
  return found;
}

async function listRules(userId: string) {
  return getDb().select().from(categoryRules).where(eq(categoryRules.userId, userId));
}

export type AnalyzedRow = StatementRow & {
  type: "receita" | "despesa";
  category: string;
  byRule: boolean;
  clientId: string | null;
  clientName: string | null;
  duplicate: boolean;
  invoice: { id: string; number: number } | null;
};

function cleanRows(input: unknown): StatementRow[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_IMPORT_ROWS) return null;
  const rows: StatementRow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.externalId !== "string" || typeof r.date !== "string" || typeof r.description !== "string") return null;
    if (typeof r.amountCents !== "number" || !Number.isInteger(r.amountCents) || r.amountCents === 0) return null;
    if (Math.abs(r.amountCents) > 100_000_000_00 || !isValidISODate(r.date)) return null;
    rows.push({
      externalId: r.externalId.slice(0, 160),
      date: r.date,
      description: r.description.trim().slice(0, 160) || "Sem descrição",
      amountCents: r.amountCents,
    });
  }
  return rows;
}

/** Recebe as linhas lidas do arquivo e devolve as sugestões: tipo, categoria, cliente, cobrança e duplicadas. */
export async function analyzeStatement(input: StatementRow[]): Promise<{ rows: AnalyzedRow[] } | { error: string }> {
  const user = await requireUser();
  if (!hasPro(user)) return { error: "Importar extrato é um recurso do plano Pro." };
  const rows = cleanRows(input);
  if (!rows) return { error: `Arquivo inválido ou com mais de ${MAX_IMPORT_ROWS} transações.` };

  const db = getDb();
  const [existing, rules, clientRows, openInvoices] = await Promise.all([
    existingExternalIds(
      user.id,
      rows.map((r) => r.externalId),
    ),
    listRules(user.id),
    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.userId, user.id)),
    db
      .select({ id: invoices.id, number: invoices.number, totalCents: invoices.totalCents, clientId: invoices.clientId })
      .from(invoices)
      .where(and(eq(invoices.userId, user.id), eq(invoices.status, "enviada"))),
  ]);

  const usedInvoices = new Set<string>();
  const analyzed = rows.map((row): AnalyzedRow => {
    const type = row.amountCents > 0 ? "receita" : "despesa";
    const { category, byRule } = suggestCategory(row.description, type, rules);
    const client = type === "receita" ? matchClient(row.description, clientRows) : null;
    let invoice: AnalyzedRow["invoice"] = null;
    if (type === "receita") {
      const candidates = openInvoices.filter((inv) => inv.totalCents === row.amountCents && !usedInvoices.has(inv.id));
      // Prefere a cobrança do cliente reconhecido na descrição.
      const match = candidates.find((inv) => client && inv.clientId === client.id) ?? (candidates.length === 1 ? candidates[0] : null);
      if (match) {
        usedInvoices.add(match.id);
        invoice = { id: match.id, number: match.number };
      }
    }
    const invoiceClient = invoice ? clientRows.find((c) => c.id === openInvoices.find((i) => i.id === invoice.id)?.clientId) : null;
    const finalClient = client ?? invoiceClient ?? null;
    return {
      ...row,
      type,
      category,
      byRule,
      clientId: finalClient?.id ?? null,
      clientName: finalClient?.name ?? null,
      duplicate: existing.has(row.externalId),
      invoice,
    };
  });
  return { rows: analyzed };
}

type ImportRow = {
  externalId: string;
  date: string;
  description: string;
  amountCents: number;
  type: "receita" | "despesa";
  category: string;
  clientId: string | null;
  invoiceId: string | null;
};

function parseImportRows(json: string): ImportRow[] | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || data.length === 0 || data.length > MAX_IMPORT_ROWS) return null;
  const out: ImportRow[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const type = r.type === "receita" ? "receita" : r.type === "despesa" ? "despesa" : null;
    if (!type || typeof r.category !== "string" || !categoriesFor(type).includes(r.category)) return null;
    if (typeof r.externalId !== "string" || typeof r.date !== "string" || !isValidISODate(r.date)) return null;
    if (typeof r.description !== "string" || typeof r.amountCents !== "number" || !Number.isInteger(r.amountCents)) return null;
    if (r.amountCents <= 0 || r.amountCents > 100_000_000_00) return null;
    out.push({
      externalId: r.externalId.slice(0, 160),
      date: r.date,
      description: r.description.trim().slice(0, 160) || "Sem descrição",
      amountCents: r.amountCents,
      type,
      category: r.category,
      clientId: typeof r.clientId === "string" ? r.clientId : null,
      invoiceId: typeof r.invoiceId === "string" && type === "receita" ? r.invoiceId : null,
    });
  }
  return out;
}

type NewRule = { pattern: string; type: "receita" | "despesa"; category: string };

function parseNewRules(json: string): NewRule[] {
  try {
    const data: unknown = JSON.parse(json || "[]");
    if (!Array.isArray(data)) return [];
    return data
      .slice(0, 20)
      .map((r) => r as Record<string, unknown>)
      .filter((r): r is NewRule => {
        const type = r.type === "receita" || r.type === "despesa" ? r.type : null;
        return (
          !!type &&
          typeof r.pattern === "string" &&
          normalizeText(r.pattern).length >= 3 &&
          typeof r.category === "string" &&
          categoriesFor(type).includes(r.category)
        );
      })
      .map((r) => ({ pattern: normalizeText(r.pattern).slice(0, 60), type: r.type, category: r.category }));
  } catch {
    return [];
  }
}

export async function importStatement(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!hasPro(user)) return fail("Importar extrato é um recurso do plano Pro.");
  const rows = parseImportRows(text(formData, "rows", 400_000));
  if (!rows) return fail("Não foi possível ler as transações selecionadas. Envie o arquivo de novo.");

  const db = getDb();
  const existing = await existingExternalIds(
    user.id,
    rows.map((r) => r.externalId),
  );
  const fresh = rows.filter((r) => !existing.has(r.externalId));
  const ownedClients = new Set((await db.select({ id: clients.id }).from(clients).where(eq(clients.userId, user.id))).map((c) => c.id));

  let reconciled = 0;
  const plain: (typeof transactions.$inferInsert)[] = [];
  for (const row of fresh) {
    const clientId = row.clientId && ownedClients.has(row.clientId) ? row.clientId : null;
    const base = {
      id: crypto.randomUUID(),
      userId: user.id,
      type: row.type,
      description: row.description,
      amountCents: row.amountCents,
      category: row.category,
      date: row.date,
      status: "pago" as const,
      clientId,
      externalId: row.externalId,
    };
    if (row.invoiceId) {
      // Dá baixa na cobrança só se ela ainda estava em aberto e o valor bate.
      const updated = await db
        .update(invoices)
        .set({ status: "paga", paidAt: row.date })
        .where(
          and(
            eq(invoices.id, row.invoiceId),
            eq(invoices.userId, user.id),
            eq(invoices.status, "enviada"),
            eq(invoices.totalCents, row.amountCents),
          ),
        )
        .returning({ id: invoices.id, number: invoices.number, clientId: invoices.clientId, projectId: invoices.projectId });
      if (updated.length > 0) {
        const inv = updated[0];
        await db.insert(transactions).values({
          ...base,
          description: `Cobrança #${String(inv.number).padStart(4, "0")}`,
          clientId: inv.clientId ?? clientId,
          projectId: inv.projectId,
          invoiceId: inv.id,
        });
        await logEvent(user.id, "cobranca", inv.id, "pago", "Conciliado pelo extrato do banco");
        reconciled++;
        continue;
      }
    }
    plain.push(base);
  }
  for (const part of chunk(plain, 8)) await db.insert(transactions).values(part);

  // Regras que a pessoa pediu para lembrar na revisão.
  const newRules = parseNewRules(text(formData, "rules", 10_000));
  if (newRules.length > 0) {
    const current = await listRules(user.id);
    const known = new Set(current.map((r) => `${r.type}:${r.pattern}`));
    const toAdd = newRules.filter((r) => !known.has(`${r.type}:${r.pattern}`)).slice(0, Math.max(0, MAX_RULES - current.length));
    if (toAdd.length > 0) await db.insert(categoryRules).values(toAdd.map((r) => ({ id: crypto.randomUUID(), userId: user.id, ...r })));
  }

  refresh();
  const imported = fresh.length;
  const skipped = rows.length - fresh.length;
  const parts = [`${imported} ${imported === 1 ? "lançamento importado" : "lançamentos importados"}`];
  if (reconciled > 0) parts.push(`${reconciled} ${reconciled === 1 ? "cobrança marcada como paga" : "cobranças marcadas como pagas"}`);
  if (skipped > 0) parts.push(`${skipped} já ${skipped === 1 ? "existia" : "existiam"}`);
  return success(`${parts.join(", ")}.`);
}

export async function saveCategoryRule(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const pattern = normalizeText(text(formData, "pattern", 60));
  const type = text(formData, "type") === "receita" ? "receita" : "despesa";
  const category = text(formData, "category", 60);
  if (pattern.length < 3) return fail("Use pelo menos 3 letras. Ex.: uber");
  if (!categoriesFor(type).includes(category)) return fail("Escolha uma categoria.");
  const current = await listRules(user.id);
  if (current.length >= MAX_RULES) return fail(`Você pode ter até ${MAX_RULES} regras.`);
  if (current.some((r) => r.type === type && r.pattern === pattern)) return fail("Já existe uma regra com esse texto.");
  await getDb().insert(categoryRules).values({ id: crypto.randomUUID(), userId: user.id, pattern, type, category });
  refresh();
  return success("Regra criada. Vale para as próximas importações.");
}

export async function deleteCategoryRule(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  await getDb()
    .delete(categoryRules)
    .where(and(eq(categoryRules.id, text(formData, "id", 64)), eq(categoryRules.userId, user.id)));
  refresh();
  return success("Regra excluída.");
}
