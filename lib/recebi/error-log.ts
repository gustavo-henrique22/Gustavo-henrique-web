// Registro de erros do site para o admin (substitui um serviço externo de monitoramento).
// Tira e-mails, números longos e tokens da mensagem antes de guardar.
import { desc, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { errorLogs } from "@/db/schema";
import { scrubErrorText } from "./error-scrub";
import { sqliteTimestamp } from "./rate-limit";

export { scrubErrorText };

const KEEP_DAYS = 30;

export async function logError(data: {
  source: "navegador" | "servidor";
  message: string;
  path?: string;
  digest?: string;
  userId?: string | null;
}) {
  try {
    await getDb()
      .insert(errorLogs)
      .values({
        id: crypto.randomUUID(),
        source: data.source,
        message: scrubErrorText(data.message || "Erro sem mensagem"),
        path: scrubErrorText(data.path ?? "", 200),
        digest: (data.digest ?? "").replace(/[^\w-]/g, "").slice(0, 64),
        userId: data.userId ?? null,
      });
  } catch (error) {
    console.error("registro-de-erro", error);
  }
}

export async function recentErrors(limit = 20) {
  const db = getDb();
  const since = sqliteTimestamp(Date.now() - 86_400_000);
  const [rows, [last24h]] = await Promise.all([
    db.select().from(errorLogs).orderBy(desc(errorLogs.createdAt)).limit(limit),
    db
      .select({ n: sql<number>`count(*)` })
      .from(errorLogs)
      .where(gte(errorLogs.createdAt, since)),
  ]);
  return { rows, last24h: last24h.n };
}

export async function removeOldErrors(): Promise<number> {
  const removed = await getDb()
    .delete(errorLogs)
    .where(lt(errorLogs.createdAt, sqliteTimestamp(Date.now() - KEEP_DAYS * 86_400_000)))
    .returning({ id: errorLogs.id });
  return removed.length;
}
