// Resumo do mês: enviado por e-mail no começo de cada mês e guardado no sininho.
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, users } from "@/db/schema";
import { notify } from "./activity";
import { APP_PATH } from "./config";
import { addMonths, currentMonth, monthBounds, monthLabel, todayISO } from "./dates";
import { incomeByClient, monthlySeries, openReceivables } from "./data";
import { emailEnabled, emailLayout, escapeHtml, sendEmail } from "./email";
import { formatMoney } from "./money";
import { siteOrigin } from "./origin";

export type MonthSummary = {
  month: string;
  income: number;
  expense: number;
  profit: number;
  incomeChange: number | null;
  receivable: number;
  overdue: number;
  topClient: { name: string; total: number } | null;
  goalPercent: number | null;
};

export async function buildMonthSummary(user: { id: string; monthlyGoalCents: number }, month: string): Promise<MonthSummary> {
  const { start, end } = monthBounds(month);
  const [series, receivables, clientsRank] = await Promise.all([
    monthlySeries(user.id, month, 2),
    openReceivables(user.id),
    incomeByClient(user.id, start, end, 1),
  ]);
  const [previous, current] = series;
  const top = clientsRank[0];
  return {
    month,
    income: current.income,
    expense: current.expense,
    profit: current.profit,
    incomeChange: previous.income > 0 ? Math.round(((current.income - previous.income) / previous.income) * 100) : null,
    receivable: receivables.total,
    overdue: receivables.overdue,
    topClient: top?.name ? { name: top.name, total: top.total } : null,
    goalPercent: user.monthlyGoalCents > 0 ? Math.round((current.income / user.monthlyGoalCents) * 100) : null,
  };
}

function summaryParagraphs(s: MonthSummary): string[] {
  const label = monthLabel(s.month).split(" de ")[0];
  const change =
    s.incomeChange === null
      ? ""
      : s.incomeChange >= 0
        ? ` (<strong style="color:#1a7f4b">▲ ${s.incomeChange}%</strong> vs o mês anterior)`
        : ` (▼ ${Math.abs(s.incomeChange)}% vs o mês anterior)`;
  const lines = [
    `Em ${label} você recebeu <strong>${formatMoney(s.income)}</strong>${change} e gastou <strong>${formatMoney(s.expense)}</strong>.`,
  ];
  if (s.goalPercent !== null) {
    lines.push(
      s.goalPercent >= 100
        ? `Meta batida: ${s.goalPercent}% do que você planejou. 🎉`
        : `Você chegou a ${s.goalPercent}% da sua meta do mês.`,
    );
  }
  if (s.topClient)
    lines.push(`Seu melhor cliente foi <strong>${escapeHtml(s.topClient.name)}</strong>, com ${formatMoney(s.topClient.total)}.`);
  if (s.receivable > 0) {
    lines.push(
      `Ainda há <strong>${formatMoney(s.receivable)}</strong> a receber${s.overdue > 0 ? `, sendo ${formatMoney(s.overdue)} em atraso — vale mandar um lembrete` : ""}.`,
    );
  }
  return lines;
}

/**
 * Envia o resumo do mês anterior para quem pediu. Roda todo dia pelo cron, mas só faz algo
 * nos primeiros dias do mês e uma única vez por pessoa (marcado pelo aviso "resumo:AAAA-MM").
 */
export async function sendMonthlySummaries(limit = 100): Promise<number> {
  if (Number(todayISO().slice(8, 10)) > 7) return 0;
  const month = addMonths(currentMonth(), -1);
  const type = `resumo:${month}`;
  const db = getDb();
  const people = await db
    .select({ id: users.id, name: users.name, email: users.email, monthlyGoalCents: users.monthlyGoalCents, createdAt: users.createdAt })
    .from(users)
    .where(and(eq(users.monthlySummary, true), eq(users.isDemo, false)))
    .limit(2000);
  const done = new Set(
    (await db.select({ userId: notifications.userId }).from(notifications).where(eq(notifications.type, type))).map((n) => n.userId),
  );

  const origin = await siteOrigin();
  let sent = 0;
  for (const person of people) {
    if (sent >= limit) break;
    if (done.has(person.id) || person.createdAt.slice(0, 7) > month) continue;
    const summary = await buildMonthSummary(person, month);
    if (summary.income === 0 && summary.expense === 0 && summary.receivable === 0) continue;
    const label = monthLabel(month).split(" de ")[0];
    await notify(person.id, {
      type,
      title: `Resumo de ${label}: lucro de ${formatMoney(summary.profit)}`,
      body: `Recebido ${formatMoney(summary.income)} · gasto ${formatMoney(summary.expense)}`,
      href: `${APP_PATH}/relatorios`,
    });
    if (emailEnabled()) {
      await sendEmail({
        to: person.email,
        subject: `Seu resumo de ${label} no Recebi`,
        html: emailLayout({
          preheader: `Lucro de ${formatMoney(summary.profit)} em ${label}.`,
          title: `${person.name.split(" ")[0]}, este foi o seu ${label}`,
          paragraphs: summaryParagraphs(summary),
          highlight: { label: `Lucro de ${label}`, value: formatMoney(summary.profit) },
          cta: { label: "Ver relatório completo", url: `${origin}${APP_PATH}/relatorios` },
          footer: "Você recebe este resumo uma vez por mês. Para desligar, vá em Configurações → Avisos por e-mail.",
        }),
      });
    }
    sent++;
  }
  return sent;
}
