// "Não fui eu — bloquear minha conta": link enviado nos alertas de segurança. Quem abre o link (prova que tem o
// e-mail) derruba todas as sessões, invalida a senha e remove as chaves de acesso. Para voltar, usa
// "Esqueci a senha" (a verificação em duas etapas, se ativa, continua valendo).
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { emailTokens, passkeys, sessions, users } from "@/db/schema";
import { BASE_PATH } from "./config";
import { randomToken, sha256Hex } from "./crypto";
import { siteOrigin } from "./origin";
import { logSecurityEvent } from "./security";

const PURPOSE = "bloquear-conta";
const VALID_DAYS = 7;

export async function lockLink(userId: string): Promise<string> {
  const token = randomToken();
  await getDb()
    .insert(emailTokens)
    .values({
      id: await sha256Hex(token),
      userId,
      purpose: PURPOSE,
      expiresAt: new Date(Date.now() + VALID_DAYS * 86_400_000).toISOString(),
    });
  return `${await siteOrigin()}${BASE_PATH}/bloquear-conta/${token}`;
}

/** Confere se o link ainda vale (sem usar). */
export async function lockTokenValid(token: string): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const [row] = await getDb()
    .select()
    .from(emailTokens)
    .where(and(eq(emailTokens.id, await sha256Hex(token)), eq(emailTokens.purpose, PURPOSE)))
    .limit(1);
  return !!row && !row.usedAt && row.expiresAt > new Date().toISOString();
}

/** Bloqueia a conta. Devolve true se o link era válido. */
export async function lockAccount(token: string): Promise<boolean> {
  if (!(await lockTokenValid(token))) return false;
  const db = getDb();
  const [row] = await db
    .update(emailTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(emailTokens.id, await sha256Hex(token)))
    .returning({ userId: emailTokens.userId });
  if (!row) return false;
  await db.delete(sessions).where(eq(sessions.userId, row.userId));
  await db.delete(passkeys).where(eq(passkeys.userId, row.userId));
  // Senha que nunca confere: só "Esqueci a senha" (pelo e-mail) devolve o acesso.
  await db
    .update(users)
    .set({ passwordHash: `bloqueada$${randomToken(16)}` })
    .where(eq(users.id, row.userId));
  await logSecurityEvent(row.userId, "conta-bloqueada");
  return true;
}
