// Números do negócio para o painel de administração (só o admin vê).
import { and, eq, gte, isNotNull, like, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { invoices, loginAttempts, payments, referralRewards, sessions, users } from "@/db/schema";
import { addDays, addMonths, currentMonth, monthShortLabel, todayISO } from "./dates";
import { sqliteTimestamp } from "./rate-limit";

const count = sql<number>`count(*)`;

export async function businessMetrics() {
  const db = getDb();
  const today = todayISO();
  const d7 = addDays(today, -7);
  const d30 = addDays(today, -30);
  const d60 = addDays(today, -60);
  const month = currentMonth();
  const firstChartMonth = addMonths(month, -5);
  const realUser = eq(users.isDemo, false);
  const proActive = sql`${users.plan} = 'pro' and (${users.planExpiresAt} is null or ${users.planExpiresAt} >= ${today})`;

  const [[people], [active], signupRows, [revenue], revenueRows, activePayments, [volume], [ai], [referrals]] = await Promise.all([
    db
      .select({
        total: count,
        new7: sql<number>`coalesce(sum(case when ${users.createdAt} >= ${d7} then 1 else 0 end), 0)`,
        new30: sql<number>`coalesce(sum(case when ${users.createdAt} >= ${d30} then 1 else 0 end), 0)`,
        prev30: sql<number>`coalesce(sum(case when ${users.createdAt} >= ${d60} and ${users.createdAt} < ${d30} then 1 else 0 end), 0)`,
        pro: sql<number>`coalesce(sum(case when ${proActive} then 1 else 0 end), 0)`,
        churned30: sql<number>`coalesce(sum(case when ${users.plan} = 'pro' and ${users.planExpiresAt} >= ${d30} and ${users.planExpiresAt} < ${today} then 1 else 0 end), 0)`,
        withPix: sql<number>`coalesce(sum(case when ${users.pixKey} <> '' then 1 else 0 end), 0)`,
        withPage: sql<number>`coalesce(sum(case when ${users.publicProfile} then 1 else 0 end), 0)`,
        with2fa: sql<number>`coalesce(sum(case when ${users.totpEnabledAt} is not null then 1 else 0 end), 0)`,
        verified: sql<number>`coalesce(sum(case when ${users.emailVerifiedAt} is not null then 1 else 0 end), 0)`,
        referred: sql<number>`coalesce(sum(case when ${users.referredBy} is not null then 1 else 0 end), 0)`,
      })
      .from(users)
      .where(realUser),
    db
      .select({
        d7: sql<number>`count(distinct case when coalesce(${sessions.lastSeenAt}, ${sessions.createdAt}) >= ${d7} then ${sessions.userId} end)`,
        d30: sql<number>`count(distinct ${sessions.userId})`,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(realUser, sql`coalesce(${sessions.lastSeenAt}, ${sessions.createdAt}) >= ${d30}`)),
    db
      .select({ day: sql<string>`substr(${users.createdAt}, 1, 10)`, n: count })
      .from(users)
      .where(and(realUser, gte(users.createdAt, d30)))
      .groupBy(sql`substr(${users.createdAt}, 1, 10)`),
    db
      .select({
        month: sql<number>`coalesce(sum(case when ${payments.createdAt} >= ${`${month}-01`} then ${payments.amountCents} else 0 end), 0)`,
        last30: sql<number>`coalesce(sum(case when ${payments.createdAt} >= ${d30} then ${payments.amountCents} else 0 end), 0)`,
        total: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
        count: count,
      })
      .from(payments)
      .where(ne(payments.status, "estornado")),
    db
      .select({ month: sql<string>`substr(${payments.createdAt}, 1, 7)`, total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
      .from(payments)
      .where(and(gte(payments.createdAt, `${firstChartMonth}-01`), ne(payments.status, "estornado")))
      .groupBy(sql`substr(${payments.createdAt}, 1, 7)`),
    // Receita recorrente: valor mensal do último pagamento de cada assinante Pro ativo.
    db
      .select({ userId: payments.userId, amountCents: payments.amountCents, months: payments.months, createdAt: payments.createdAt })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.userId))
      .where(and(ne(payments.status, "estornado"), sql`${proActive}`)),
    db
      .select({ paid30: sql<number>`coalesce(sum(${invoices.totalCents}), 0)`, count: count })
      .from(invoices)
      .where(and(eq(invoices.status, "paga"), isNotNull(invoices.paidAt), gte(invoices.paidAt, d30))),
    db
      .select({ n: count })
      .from(loginAttempts)
      .where(and(like(loginAttempts.email, "ai:%"), gte(loginAttempts.createdAt, sqliteTimestamp(Date.now() - 2 * 86_400_000)))),
    db.select({ rewards: count, months: sql<number>`coalesce(sum(${referralRewards.months}), 0)` }).from(referralRewards),
  ]);

  const signups = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(today, i - 29);
    return { label: day.slice(8, 10) + "/" + day.slice(5, 7), value: signupRows.find((r) => r.day === day)?.n ?? 0 };
  });
  const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(firstChartMonth, i);
    return { label: monthShortLabel(m), value: revenueRows.find((r) => r.month === m)?.total ?? 0 };
  });
  const latest = new Map<string, { monthly: number; at: string }>();
  for (const p of activePayments) {
    const current = latest.get(p.userId);
    if (!current || p.createdAt > current.at) latest.set(p.userId, { monthly: p.amountCents / Math.max(p.months, 1), at: p.createdAt });
  }
  const mrr = Math.round([...latest.values()].reduce((sum, p) => sum + p.monthly, 0));
  const total = people.total;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return {
    users: { total, new7: people.new7, new30: people.new30, prev30: people.prev30, active7: active.d7, active30: active.d30 },
    pro: {
      active: people.pro,
      paying: latest.size,
      conversion: pct(people.pro),
      churned30: people.churned30,
      mrr,
    },
    revenue: {
      month: revenue.month,
      last30: revenue.last30,
      total: revenue.total,
      payments: revenue.count,
      avgTicket: revenue.count ? Math.round(revenue.total / revenue.count) : 0,
    },
    usage: { invoicesPaid30: volume.count, volumePaid30: volume.paid30, aiQuestions48h: ai.n },
    adoption: { pix: pct(people.withPix), page: pct(people.withPage), twoFactor: pct(people.with2fa), verified: pct(people.verified) },
    referrals: { referred: people.referred, rewards: referrals.rewards, months: referrals.months },
    signups,
    revenueByMonth,
  };
}
