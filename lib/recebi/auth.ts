// Contas, sessões e redefinição de senha. Só pode ser usado no servidor.
import { env } from "cloudflare:workers";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { loginAttempts, passwordResets, sessions, users, type User } from "@/db/schema";
import { APP_PATH, BASE_PATH, SESSION_COOKIE, SESSION_DAYS } from "./config";
import { hashPassword, randomToken, sha256Hex, verifyPassword } from "./crypto";

export { hashPassword, verifyPassword };

/** Valor guardado no lugar da senha para contas criadas pelo login com Google. */
export const GOOGLE_ONLY_PASSWORD = "google";

function isoIn(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** E-mails em RECEBI_ADMIN_EMAILS (separados por vírgula) viram administradores. */
function adminEmailsFromEnv(): string[] {
  const raw = (env as unknown as Record<string, unknown>).RECEBI_ADMIN_EMAILS;
  return typeof raw === "string" ? raw.split(",").map(normalizeEmail).filter(Boolean) : [];
}

export async function isAdminEmail(email: string): Promise<boolean> {
  const fromEnv = adminEmailsFromEnv();
  if (fromEnv.length > 0) return fromEnv.includes(normalizeEmail(email));
  // Sem a variável configurada, a primeira conta criada é a do administrador.
  const [{ count }] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.isDemo, false));
  return count === 0;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const db = getDb();
  await db.insert(sessions).values({
    id: await sha256Hex(token),
    userId,
    expiresAt: isoIn(SESSION_DAYS * 86_400_000),
  });
  // Limpeza oportunista de sessões vencidas e de contadores antigos (tentativas, limites).
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString()));
  await db
    .delete(loginAttempts)
    .where(lt(loginAttempts.createdAt, new Date(Date.now() - 2 * 86_400_000).toISOString().replace("T", " ").slice(0, 19)));

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: BASE_PATH,
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb()
      .delete(sessions)
      .where(eq(sessions.id, await sha256Hex(token)));
  }
  jar.delete({ name: SESSION_COOKIE, path: BASE_PATH });
}

/** Desconecta todos os aparelhos, menos o atual. */
export async function destroyOtherSessions(userId: string): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  await getDb()
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, await sha256Hex(token))));
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

/** Usuário logado nesta requisição, ou null. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await getDb()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, await sha256Hex(token)), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1);

  return row?.user ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`${BASE_PATH}/entrar`);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isAdmin) redirect(APP_PATH);
  return user;
}

/** O plano Pro vale enquanto não passar da data de expiração (se houver). */
export function hasPro(user: Pick<User, "plan" | "planExpiresAt">): boolean {
  if (user.plan !== "pro") return false;
  return !user.planExpiresAt || user.planExpiresAt >= new Date().toISOString().slice(0, 10);
}

/** Cria um link de redefinição de senha válido por 24 horas e devolve o token. */
export async function createPasswordReset(userId: string): Promise<string> {
  const token = randomToken();
  await getDb()
    .insert(passwordResets)
    .values({ id: await sha256Hex(token), userId, expiresAt: isoIn(86_400_000) });
  return token;
}

export async function findValidPasswordReset(token: string) {
  const [row] = await getDb()
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.id, await sha256Hex(token)))
    .limit(1);
  if (!row || row.usedAt || row.expiresAt < new Date().toISOString()) return null;
  return row;
}
