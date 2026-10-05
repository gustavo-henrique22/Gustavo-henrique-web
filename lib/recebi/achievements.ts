// Conquistas do painel: busca os números, avalia e avisa (uma vez) quando uma nova é desbloqueada.
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, invoices, notifications, quotes, transactions } from "@/db/schema";
import { evaluateAchievements, type Achievement } from "./achievement-rules";
import { notify } from "./activity";
import { APP_PATH } from "./config";

export async function loadAchievements(
  userId: string,
  extra: { monthlyProfit: number[]; goalCents: number; monthIncomeCents: number },
  { announce = true } = {},
): Promise<Achievement[]> {
  const db = getDb();
  const count = sql<number>`count(*)`;
  const [[paid], [received], [approved], [clientCount]] = await Promise.all([
    db
      .select({ n: count })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), eq(invoices.status, "paga"))),
    db
      .select({ total: sql<number>`coalesce(sum(${transactions.amountCents}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "receita"), eq(transactions.status, "pago"))),
    db
      .select({ n: count })
      .from(quotes)
      .where(and(eq(quotes.userId, userId), eq(quotes.status, "aprovado"))),
    db.select({ n: count }).from(clients).where(eq(clients.userId, userId)),
  ]);
  const list = evaluateAchievements({
    paidInvoices: paid.n,
    totalReceivedCents: received.total,
    approvedQuotes: approved.n,
    clients: clientCount.n,
    ...extra,
  });
  if (announce) {
    const earned = list.filter((a) => a.earned);
    if (earned.length) {
      const types = earned.map((a) => `conquista:${a.key}`);
      const seen = new Set(
        (
          await db
            .select({ type: notifications.type })
            .from(notifications)
            .where(and(eq(notifications.userId, userId), inArray(notifications.type, types)))
        ).map((n) => n.type),
      );
      for (const a of earned) {
        if (seen.has(`conquista:${a.key}`)) continue;
        await notify(userId, { type: `conquista:${a.key}`, title: `🏆 Conquista: ${a.title}`, body: a.description, href: APP_PATH });
      }
    }
  }
  return list;
}
