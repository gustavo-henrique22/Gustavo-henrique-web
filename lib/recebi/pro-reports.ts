// Relatórios avançados do plano Pro: lucro por cliente e por projeto, quem paga atrasado e o MEI (DAS e limite anual).
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, invoices, projects, transactions } from "@/db/schema";
import { daysBetween, todayISO } from "./dates";

/** DAS mensal do MEI de serviços quando a pessoa não informou o valor (5% do salário mínimo + ISS). */
export const DEFAULT_DAS_CENTS = 8_600;

const income = sql<number>`coalesce(sum(case when ${transactions.type} = 'receita' then ${transactions.amountCents} else 0 end), 0)`;
const expense = sql<number>`coalesce(sum(case when ${transactions.type} = 'despesa' then ${transactions.amountCents} else 0 end), 0)`;

type ProfitRow = { id: string | null; label: string; income: number; expense: number; profit: number; margin: number | null };

function toRows(rows: { id: string | null; name: string | null; income: number; expense: number }[], empty: string): ProfitRow[] {
  return rows
    .map((r) => ({
      id: r.id,
      label: r.name ?? empty,
      income: r.income,
      expense: r.expense,
      profit: r.income - r.expense,
      margin: r.income > 0 ? Math.round(((r.income - r.expense) / r.income) * 100) : null,
    }))
    .sort((a, b) => b.profit - a.profit);
}

function paidBetween(userId: string, start: string, end: string) {
  return and(eq(transactions.userId, userId), eq(transactions.status, "pago"), gte(transactions.date, start), lte(transactions.date, end));
}

export async function profitByClient(userId: string, start: string, end: string): Promise<ProfitRow[]> {
  const rows = await getDb()
    .select({ id: transactions.clientId, name: clients.name, income, expense })
    .from(transactions)
    .leftJoin(clients, eq(clients.id, transactions.clientId))
    .where(paidBetween(userId, start, end))
    .groupBy(transactions.clientId);
  return toRows(rows, "Sem cliente");
}

export async function profitByProject(userId: string, start: string, end: string): Promise<ProfitRow[]> {
  const rows = await getDb()
    .select({ id: transactions.projectId, name: projects.name, income, expense })
    .from(transactions)
    .leftJoin(projects, eq(projects.id, transactions.projectId))
    .where(and(paidBetween(userId, start, end), isNotNull(transactions.projectId)))
    .groupBy(transactions.projectId);
  return toRows(rows, "Projeto removido");
}

export type LatePayer = { clientId: string; name: string; invoices: number; late: number; avgDaysLate: number; openLateCents: number };

/** Clientes que pagam com atraso ou estão devendo cobranças vencidas. */
export async function latePayers(userId: string, since: string): Promise<LatePayer[]> {
  const today = todayISO();
  const rows = await getDb()
    .select({
      clientId: invoices.clientId,
      name: clients.name,
      status: invoices.status,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      total: invoices.totalCents,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.userId, userId), gte(invoices.dueDate, since), sql`${invoices.status} in ('enviada', 'paga')`));
  const map = new Map<string, LatePayer & { daysSum: number }>();
  for (const r of rows) {
    if (!r.clientId) continue;
    const entry = map.get(r.clientId) ?? {
      clientId: r.clientId,
      name: r.name,
      invoices: 0,
      late: 0,
      avgDaysLate: 0,
      openLateCents: 0,
      daysSum: 0,
    };
    entry.invoices++;
    const paidDay = r.paidAt ? r.paidAt.slice(0, 10) : null;
    const lateDays = paidDay ? daysBetween(r.dueDate, paidDay) : r.status === "enviada" && r.dueDate < today ? daysBetween(r.dueDate, today) : 0;
    if (lateDays > 0) {
      entry.late++;
      entry.daysSum += lateDays;
      if (!paidDay) entry.openLateCents += r.total;
    }
    map.set(r.clientId, entry);
  }
  return [...map.values()]
    .filter((e) => e.late > 0)
    .map(({ daysSum, ...e }) => ({ ...e, avgDaysLate: Math.round(daysSum / e.late) }))
    .sort((a, b) => b.openLateCents - a.openLateCents || b.avgDaysLate - a.avgDaysLate)
    .slice(0, 10);
}

export type MeiForecast = {
  dasMonthly: number;
  dasYear: number;
  dasRemaining: number;
  projectedIncome: number;
  limit: number;
  usedPercent: number;
  projectedPercent: number;
  /** "ok", "atencao" (passa de 80% na projeção), "estoura" (projeção acima do limite) ou "passou". */
  level: "ok" | "atencao" | "estoura" | "passou";
  /** Mês (1-12) em que o limite deve ser atingido no ritmo atual, se for no ano. */
  limitMonth: number | null;
};

export function meiForecast({
  incomeYear,
  monthsElapsed,
  annualLimitCents,
  dasCents,
}: {
  incomeYear: number;
  monthsElapsed: number;
  annualLimitCents: number;
  dasCents: number;
}): MeiForecast {
  const dasMonthly = dasCents > 0 ? dasCents : DEFAULT_DAS_CENTS;
  const months = Math.min(Math.max(monthsElapsed, 0), 12);
  const perMonth = months > 0 ? incomeYear / months : 0;
  const projectedIncome = Math.round(perMonth * 12);
  const limit = annualLimitCents;
  const usedPercent = limit > 0 ? Math.round((incomeYear / limit) * 100) : 0;
  const projectedPercent = limit > 0 ? Math.round((projectedIncome / limit) * 100) : 0;
  const level = usedPercent >= 100 ? "passou" : projectedPercent > 100 ? "estoura" : projectedPercent >= 80 ? "atencao" : "ok";
  const limitMonth = perMonth > 0 && limit > 0 && projectedIncome > limit ? Math.min(12, Math.ceil(limit / perMonth)) : null;
  return {
    dasMonthly,
    dasYear: dasMonthly * 12,
    dasRemaining: dasMonthly * (12 - months),
    projectedIncome,
    limit,
    usedPercent,
    projectedPercent,
    level,
    limitMonth,
  };
}
