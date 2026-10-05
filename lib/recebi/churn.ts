// Cancelamentos e perda de assinantes (painel do admin).
import { and, desc, eq, gte, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { externalPayments, payments, users } from "@/db/schema";
import { addDays, todayISO } from "./dates";

export async function churnReport() {
  const db = getDb();
  const today = todayISO();
  const d30 = addDays(today, -30);
  const d90 = addDays(today, -90);
  const realUser = eq(users.isDemo, false);

  const [lost, [trials], events] = await Promise.all([
    // Pro que venceu nos últimos 90 dias e não foi renovado.
    db
      .select({ id: users.id, name: users.name, email: users.email, expiredAt: users.planExpiresAt, trialEndsAt: users.trialEndsAt })
      .from(users)
      .where(
        and(realUser, eq(users.plan, "pro"), isNotNull(users.planExpiresAt), gte(users.planExpiresAt, d90), lt(users.planExpiresAt, today)),
      )
      .orderBy(desc(users.planExpiresAt))
      .limit(200),
    // Testes grátis que terminaram nos últimos 90 dias, e quantos viraram pagantes.
    db
      .select({
        ended: sql<number>`count(*)`,
        converted: sql<number>`coalesce(sum(case when exists (select 1 from ${payments} where ${payments.userId} = ${users.id} and ${payments.status} <> 'estornado') then 1 else 0 end), 0)`,
      })
      .from(users)
      .where(and(realUser, isNotNull(users.trialEndsAt), gte(users.trialEndsAt, d90), lt(users.trialEndsAt, today))),
    db
      .select({
        kind: externalPayments.event,
        status: externalPayments.status,
        email: externalPayments.email,
        createdAt: externalPayments.createdAt,
      })
      .from(externalPayments)
      .where(gte(externalPayments.createdAt, d30))
      .orderBy(desc(externalPayments.createdAt))
      .limit(300),
  ]);

  // Valor mensal que cada pessoa que saiu pagava (último pagamento não estornado).
  const ids = lost.map((u) => u.id);
  const paid = ids.length
    ? await db
        .select({ userId: payments.userId, amountCents: payments.amountCents, months: payments.months, createdAt: payments.createdAt })
        .from(payments)
        .where(and(inArray(payments.userId, ids), ne(payments.status, "estornado")))
    : [];
  const monthly = new Map<string, { value: number; at: string }>();
  for (const p of paid) {
    const current = monthly.get(p.userId);
    if (!current || p.createdAt > current.at) monthly.set(p.userId, { value: p.amountCents / Math.max(p.months, 1), at: p.createdAt });
  }
  const people = lost.map((u) => ({
    ...u,
    paying: monthly.has(u.id),
    trialOnly: !monthly.has(u.id) && !!u.trialEndsAt,
    monthlyCents: Math.round(monthly.get(u.id)?.value ?? 0),
  }));
  const isRefund = (e: { kind: string; status: string }) => /refund|reembols|estorn|chargeback/i.test(`${e.kind} ${e.status}`);
  const isCancel = (e: { kind: string; status: string }) => /cancel/i.test(`${e.kind} ${e.status}`);
  const lost30 = people.filter((p) => p.paying && (p.expiredAt ?? "") >= d30);

  return {
    people,
    lost30: lost30.length,
    lostMrr30: lost30.reduce((sum, p) => sum + p.monthlyCents, 0),
    refunds30: events.filter(isRefund).length,
    cancellations30: events.filter(isCancel).length,
    trials: {
      ended: trials.ended,
      converted: trials.converted,
      rate: trials.ended ? Math.round((trials.converted / trials.ended) * 100) : 0,
    },
  };
}
