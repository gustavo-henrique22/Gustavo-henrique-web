// Cópia de segurança diária do banco: todas as tabelas em JSON, criptografadas (AES-256-GCM, mesma chave dos dados
// sensíveis) e guardadas no armazenamento de arquivos (R2) por BACKUP_DAYS dias. Feita pelas tarefas automáticas.
// Para restaurar: scripts/restaurar-backup.mjs (veja o README).
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { todayISO } from "./dates";
import { encryptField, encryptionEnabled } from "./encryption";
import { filesEnabled, listFiles, putFile, removeFile } from "./files";

export const BACKUP_DAYS = 7;
export const BACKUP_PREFIX = "backups/";
/** Contexto da criptografia das cópias (o script de restauração usa o mesmo). */
export const BACKUP_CONTEXT = "recebi-backup";

/** Tabelas que não entram: dados passageiros (tentativas, desafios, sessões e links de uso único). */
const SKIP = new Set([
  "d1_migrations",
  "login_attempts",
  "login_challenges",
  "passkey_challenges",
  "sessions",
  "email_tokens",
  "password_resets",
]);

export function backupsEnabled(): boolean {
  return filesEnabled() && encryptionEnabled();
}

export async function createBackup(day = todayISO()): Promise<{ key: string; tables: number; rows: number } | null> {
  if (!backupsEnabled()) return null;
  const db = getDb();
  const names = (
    await db.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%' order by name`,
    )
  )
    .map((row) => row.name)
    .filter((name) => !SKIP.has(name));
  const tables: Record<string, unknown[]> = {};
  let rows = 0;
  for (const name of names) {
    tables[name] = await db.all(sql`select * from ${sql.identifier(name)}`);
    rows += tables[name].length;
  }
  const payload = JSON.stringify({ app: "recebi", version: 1, day, createdAt: new Date().toISOString(), tables });
  const key = `${BACKUP_PREFIX}${day}.json.enc`;
  await putFile(key, await encryptField(payload, BACKUP_CONTEXT), "application/octet-stream");
  await pruneBackups();
  return { key, tables: names.length, rows };
}

export async function listBackups(): Promise<{ key: string; date: string; size: number }[]> {
  if (!filesEnabled()) return [];
  return (await listFiles(BACKUP_PREFIX))
    .map((file) => ({ ...file, date: file.key.slice(BACKUP_PREFIX.length, BACKUP_PREFIX.length + 10) }))
    .filter((file) => /^\d{4}-\d{2}-\d{2}$/.test(file.date))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Mantém só as cópias dos últimos BACKUP_DAYS dias. */
async function pruneBackups(): Promise<void> {
  const keep = new Set((await listBackups()).slice(0, BACKUP_DAYS).map((file) => file.key));
  for (const file of await listBackups()) if (!keep.has(file.key)) await removeFile(file.key);
}
