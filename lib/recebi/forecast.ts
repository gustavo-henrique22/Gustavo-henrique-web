// Previsão de caixa: o que deve entrar e sair no mês atual e nos próximos dois.
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { invoices, recurringInvoices, transactions } from "@/db/schema";
import { addMonths, currentMonth, monthBounds } from "./dates";
import { monthlySeries } from "./data";

export type ForecastMonth = {
  month: string;
  income: number;
  expense: number;
  result: number;
  /** Receita esperada abaixo da média recente: hora de buscar trabalho. */
  lowIncome: boolean;
  /** Despesas estimadas pela média (não há contas lançadas suficientes). */
  expenseEstimated: boolean;
};

export async function cashForecast(userId: string): Promise<{ months: ForecastMonth[]; avgIncome: number; avgExpense: number }> {
  const db = getDb();
  const now = currentMonth();
  const months = [now, addMonths(now, 1), addMonths(now, 2)];
  const lastEnd = monthBounds(months[2]).end;

  const history = await monthlySeries(userId, addMonths(now, -1), 3);
  const avgIncome = Math.round(history.reduce((s, m) => s + m.income, 0) / 3);
  const avgExpense = Math.round(history.reduce((s, m) => s + m.expense, 0) / 3);

  const [txRows, invoiceRows, recurring] = await Promise.all([
    db
      .select({
        month: sql<string>`substr(${transactions.date}, 1, 7)`,
        type: transactions.type,
        status: transactions.status,
        total: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.date, `${now}-01`), lte(transactions.date, lastEnd)))
      .groupBy(sql`substr(${transactions.date}, 1, 7)`, transactions.type, transactions.status),
    // Cobranças em aberto; as atrasadas contam no mês atual.
    db
      .select({
        month: sql<string>`case when ${invoices.dueDate} < ${`${now}-01`} then ${now} else substr(${invoices.dueDate}, 1, 7) end`,
        total: sql<number>`coalesce(sum(${invoices.totalCents}), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), eq(invoices.status, "enviada"), lte(invoices.dueDate, lastEnd)))
      .groupBy(sql`case when ${invoices.dueDate} < ${`${now}-01`} then ${now} else substr(${invoices.dueDate}, 1, 7) end`),
    db
      .select({ amount: recurringInvoices.amountCents, nextDate: recurringInvoices.nextDate })
      .from(recurringInvoices)
      .where(and(eq(recurringInvoices.userId, userId), eq(recurringInvoices.active, true))),
  ]);

  const tx = (month: string, type: string, status: string) =>
    txRows.find((r) => r.month === month && r.type === type && r.status === status)?.total ?? 0;

  const result = months.map((month, index) => {
    const openInvoices = invoiceRows.find((r) => r.month === month)?.total ?? 0;
    // Recorrências ainda não geradas caem uma vez por mês a partir da próxima data.
    const recurringIncome = recurring.filter((r) => r.nextDate.slice(0, 7) <= month).reduce((s, r) => s + r.amount, 0);
    const income = tx(month, "receita", "pago") + tx(month, "receita", "pendente") + openInvoices + recurringIncome;
    const expensesLaunched = tx(month, "despesa", "pago") + tx(month, "despesa", "pendente");
    const expenseEstimated = index > 0 && expensesLaunched < avgExpense;
    const expense = expenseEstimated ? avgExpense : expensesLaunched;
    return {
      month,
      income,
      expense,
      result: income - expense,
      lowIncome: index > 0 && avgIncome > 0 && income < avgIncome * 0.6,
      expenseEstimated,
    };
  });

  return { months: result, avgIncome, avgExpense };
}
