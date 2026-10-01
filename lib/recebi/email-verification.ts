// Confirmação de e-mail por link (válido por 48 horas, uso único).
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { emailTokens, users, type User } from "@/db/schema";
import { BASE_PATH } from "./config";
import { randomToken, sha256Hex } from "./crypto";
import { emailEnabled } from "./email";
import { sendVerificationEmail } from "./notifications";
import { siteOrigin } from "./origin";
import { logSecurityEvent } from "./security";

const PURPOSE = "verify-email";

export async function verificationLink(userId: string): Promise<string> {
  const token = randomToken();
  const db = getDb();
  // Só o link mais recente vale.
  await db.delete(emailTokens).where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, PURPOSE)));
  await db.insert(emailTokens).values({
    id: await sha256Hex(token),
    userId,
    purpose: PURPOSE,
    expiresAt: new Date(Date.now() + 48 * 3_600_000).toISOString(),
  });
  return `${await siteOrigin()}${BASE_PATH}/confirmar-email/${token}`;
}

export async function sendEmailVerification(user: Pick<User, "id" | "name" | "email" | "isDemo" | "emailVerifiedAt">): Promise<boolean> {
  if (!emailEnabled() || user.isDemo || user.emailVerifiedAt) return false;
  await sendVerificationEmail(user, await verificationLink(user.id));
  return true;
}

/** Confere o link e marca o e-mail como confirmado. Devolve o id da conta ou null. */
export async function confirmEmailToken(token: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const db = getDb();
  const id = await sha256Hex(token);
  const [row] = await db
    .select()
    .from(emailTokens)
    .where(and(eq(emailTokens.id, id), eq(emailTokens.purpose, PURPOSE)))
    .limit(1);
  if (!row || row.expiresAt < new Date().toISOString()) return null;
  // Abrir o mesmo link de novo (ou a página carregar duas vezes) continua mostrando sucesso.
  if (row.usedAt) return row.userId;
  const now = new Date().toISOString();
  await db.update(emailTokens).set({ usedAt: now }).where(eq(emailTokens.id, id));
  const updated = await db
    .update(users)
    .set({ emailVerifiedAt: now })
    .where(and(eq(users.id, row.userId), isNull(users.emailVerifiedAt)))
    .returning({ id: users.id });
  if (updated.length > 0) await logSecurityEvent(row.userId, "email-confirmado");
  return row.userId;
}
