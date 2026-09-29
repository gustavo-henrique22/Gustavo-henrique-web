// Limite simples de uso, guardado na tabela de tentativas (login_attempts) com uma chave por finalidade.
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";

/** Horário no formato do CURRENT_TIMESTAMP do SQLite (UTC). */
export function sqliteTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

/** Registra um uso e devolve false quando `key` já passou de `max` usos na janela. */
export async function takeRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, key), gte(loginAttempts.createdAt, sqliteTimestamp(Date.now() - windowMs))));
  if (count >= max) return false;
  await db.insert(loginAttempts).values({ id: crypto.randomUUID(), email: key });
  return true;
}
