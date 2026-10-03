// Tarefa automática: criptografa dados antigos (gravados antes da chave existir) e recriptografa com a chave
// nova depois de uma troca (RECEBI_ENCRYPTION_KEY_OLD). Roda aos poucos, junto das tarefas diárias.
import { eq, or, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { clients, nfseSettings, quoteRequests, users } from "@/db/schema";
import { currentEncryptionPrefix, decryptField, encryptField, encryptionEnabled } from "./encryption";
import { openClient, openRequest, openUser, sealClient, sealRequest, sealUser } from "./sensitive";
import { openTotpSecret, sealTotpSecret } from "./two-factor";

/**
 * Só regrava se todos os campos preenchidos abriram. Um valor de uma chave que não está mais configurada
 * fica como está (nunca vira texto vazio).
 */
function allOpened(original: Record<string, unknown>, opened: Record<string, unknown>, fields: string[]): boolean {
  return fields.every((field) => !original[field] || !!opened[field]);
}

/** Valor preenchido que ainda não está com a chave atual. */
function stale(column: SQLiteColumn, prefix: string): SQL {
  return sql`(${column} is not null and ${column} <> '' and substr(${column}, 1, ${prefix.length}) <> ${prefix})`;
}

export async function reencryptPending(limit = 100): Promise<number> {
  if (!encryptionEnabled()) return 0;
  const prefix = await currentEncryptionPrefix();
  const db = getDb();
  let updated = 0;

  const userRows = await db
    .select({ id: users.id, document: users.document, pixKey: users.pixKey, phone: users.phone, totpSecret: users.totpSecret })
    .from(users)
    .where(or(stale(users.document, prefix), stale(users.pixKey, prefix), stale(users.phone, prefix), stale(users.totpSecret, prefix)))
    .limit(limit);
  for (const row of userRows) {
    const open = await openUser(row);
    const secret = row.totpSecret ? await openTotpSecret(row) : "";
    if (!allOpened(row, { ...open, totpSecret: secret }, ["document", "pixKey", "phone", "totpSecret"])) continue;
    await db
      .update(users)
      .set({ ...(await sealUser(row.id, open)), ...(secret ? { totpSecret: await sealTotpSecret(row.id, secret) } : {}) })
      .where(eq(users.id, row.id));
    updated++;
  }

  const clientRows = await db
    .select({ id: clients.id, document: clients.document, phone: clients.phone, notes: clients.notes })
    .from(clients)
    .where(or(stale(clients.document, prefix), stale(clients.phone, prefix), stale(clients.notes, prefix)))
    .limit(limit);
  for (const row of clientRows) {
    const open = await openClient(row);
    if (!allOpened(row, open, ["document", "phone", "notes"])) continue;
    await db
      .update(clients)
      .set(await sealClient(row.id, open))
      .where(eq(clients.id, row.id));
    updated++;
  }

  const requestRows = await db
    .select({ id: quoteRequests.id, phone: quoteRequests.phone, message: quoteRequests.message })
    .from(quoteRequests)
    .where(or(stale(quoteRequests.phone, prefix), stale(quoteRequests.message, prefix)))
    .limit(limit);
  for (const row of requestRows) {
    const open = await openRequest(row);
    if (!allOpened(row, open, ["phone", "message"])) continue;
    await db
      .update(quoteRequests)
      .set(await sealRequest(row.id, open))
      .where(eq(quoteRequests.id, row.id));
    updated++;
  }

  const tokenRows = await db
    .select({ userId: nfseSettings.userId, token: nfseSettings.token })
    .from(nfseSettings)
    .where(stale(nfseSettings.token, prefix))
    .limit(limit);
  for (const row of tokenRows) {
    const context = `nfse.token:${row.userId}`;
    const token = await decryptField(row.token, context);
    if (!token) continue;
    await db
      .update(nfseSettings)
      .set({ token: await encryptField(token, context) })
      .where(eq(nfseSettings.userId, row.userId));
    updated++;
  }
  return updated;
}
