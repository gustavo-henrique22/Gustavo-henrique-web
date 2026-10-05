// Contas, sessões e redefinição de senha. Só pode ser usado no servidor.
import { env } from "cloudflare:workers";
import { and, eq, gt, isNotNull, lt, ne, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { loginAttempts, passwordResets, sessions, teamMembers, users, type User } from "@/db/schema";
import { APP_PATH, BASE_PATH, SESSION_COOKIE, SESSION_DAYS } from "./config";
import { hashPassword, randomToken, sha256Hex, verifyPassword } from "./crypto";
import { todayISO } from "./dates";
import { requestMeta } from "./security";
import { openUser } from "./sensitive";

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

export const DEVICE_COOKIE = "recebi_device";

/** Identificador do aparelho (cookie de 2 anos). Guardamos só o hash dele no banco. */
async function currentDeviceHash(): Promise<string> {
  const jar = await cookies();
  let token = jar.get(DEVICE_COOKIE)?.value;
  if (!token || token.length < 20) {
    token = randomToken(24);
    jar.set(DEVICE_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: BASE_PATH, maxAge: 2 * 365 * 86_400 });
  }
  return sha256Hex(`device:${token}`);
}

export async function createSession(userId: string): Promise<{ deviceHash: string; userAgent: string; ip: string }> {
  const token = randomToken();
  const db = getDb();
  const deviceHash = await currentDeviceHash();
  const { ip, userAgent } = await requestMeta();
  const now = new Date().toISOString();
  await db.insert(sessions).values({
    id: await sha256Hex(token),
    userId,
    expiresAt: isoIn(SESSION_DAYS * 86_400_000),
    deviceId: deviceHash,
    userAgent,
    ip,
    lastSeenAt: now,
    // Acabou de entrar: conta como identidade confirmada para as telas sensíveis.
    reauthAt: now,
  });
  // Limpeza oportunista de sessões vencidas e de contadores antigos (tentativas, limites).
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
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
  return { deviceHash, userAgent, ip };
}

/** Hash da sessão atual (para marcar "este aparelho" na lista de sessões). */
export async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256Hex(token) : null;
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

type SessionInfo = { user: User; workspaceId: string | null };

/** Sessão desta requisição: quem está logado e, se for membro de equipe, em qual conta está trabalhando. */
const getSession = cache(async (): Promise<SessionInfo | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = await sha256Hex(token);
  const db = getDb();
  const [row] = await db
    .select({ user: users, lastSeenAt: sessions.lastSeenAt, workspaceId: sessions.workspaceId })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1);
  if (!row) return null;

  // "Último acesso" da sessão, atualizado no máximo a cada 15 minutos.
  const now = Date.now();
  if (!row.lastSeenAt || now - Date.parse(row.lastSeenAt) > 15 * 60_000) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(now).toISOString() })
      .where(eq(sessions.id, sessionId));
  }
  // CPF/CNPJ, chave Pix e telefone ficam criptografados no banco.
  return { user: await openUser(row.user), workspaceId: row.workspaceId };
});

/** Quem está logado de verdade (a própria conta), ou null. Use para senha, segurança, plano e administração. */
export const getCurrentUser = cache(async (): Promise<User | null> => (await getSession())?.user ?? null);

/** Conta em uso com o papel na equipe (quando a pessoa trabalha na conta de outra). */
export type AccountUser = User & {
  teamRole?: "editor" | "leitura" | "contador";
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
};

/**
 * Conta cujos dados estão sendo usados nesta requisição: a própria, ou a do dono quando um membro da equipe
 * escolheu trabalhar nela (convite aceito e o dono com Pro ativo). Null se ninguém está logado.
 */
export const getAccount = cache(async (): Promise<AccountUser | null> => {
  const session = await getSession();
  if (!session) return null;
  if (!session.workspaceId || session.workspaceId === session.user.id) return session.user;
  const [row] = await getDb()
    .select({ owner: users, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.ownerId))
    .where(and(eq(teamMembers.ownerId, session.workspaceId), eq(teamMembers.memberId, session.user.id), isNotNull(teamMembers.acceptedAt)))
    .limit(1);
  if (!row || !hasPro(row.owner)) return session.user;
  return {
    ...(await openUser(row.owner)),
    teamRole: row.role,
    actorId: session.user.id,
    actorName: session.user.name,
    actorEmail: session.user.email,
  };
});

/** Pedido de server action (gravação)? */
async function isActionRequest(): Promise<boolean> {
  try {
    const h = await headers();
    return !!(h.get("next-action") ?? h.get("x-rsc-action"));
  } catch {
    return false;
  }
}

/**
 * Para dados do dia a dia (clientes, lançamentos, cobranças...): a conta em uso. Membros "só leitura" não
 * conseguem gravar nada nela.
 */
export async function requireUser(): Promise<AccountUser> {
  const account = await getAccount();
  if (!account) redirect(`${BASE_PATH}/entrar`);
  if (account.teamRole && account.teamRole !== "editor" && (await isActionRequest())) redirect(`${APP_PATH}?somente-leitura=1`);
  return account;
}

/** Para a própria conta (senha, segurança, plano, privacidade, indicação): sempre quem está logado. */
export async function requireActor(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`${BASE_PATH}/entrar`);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireActor();
  if (!user.isAdmin) redirect(APP_PATH);
  return user;
}

/** O plano Pro vale enquanto não passar da data de expiração (se houver). */
export function hasPro(user: Pick<User, "plan" | "planExpiresAt">): boolean {
  if (user.plan !== "pro") return false;
  return !user.planExpiresAt || user.planExpiresAt >= todayISO();
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
