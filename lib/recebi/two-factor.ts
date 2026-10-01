// Verificação em duas etapas: segredo do app autenticador (criptografado), códigos de recuperação (só o hash)
// e o "desafio" de login entre a senha e o código. Só pode ser usado no servidor.
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { loginChallenges, users, type User } from "@/db/schema";
import { BASE_PATH } from "./config";
import { randomToken, sha256Hex } from "./crypto";
import { decryptField, encryptField } from "./encryption";
import { takeRateLimit } from "./rate-limit";
import { generateRecoveryCodes, normalizeRecoveryCode, verifyTotp } from "./totp";

export const TWO_FACTOR_COOKIE = "recebi_2fa";
export const CHALLENGE_MINUTES = 10;
export const MAX_CHALLENGE_ATTEMPTS = 5;

export type ChallengeMethod = "senha" | "google" | "redefinicao";

const secretContext = (userId: string) => `users.totp:${userId}`;

export function twoFactorEnabled(user: Pick<User, "totpEnabledAt">): boolean {
  return !!user.totpEnabledAt;
}

export function sealTotpSecret(userId: string, secret: string): Promise<string> {
  return encryptField(secret, secretContext(userId));
}

export function openTotpSecret(user: Pick<User, "id" | "totpSecret">): Promise<string> {
  return decryptField(user.totpSecret, secretContext(user.id));
}

const hashRecoveryCode = (userId: string, code: string) => sha256Hex(`recovery:${userId}:${code}`);

/** Gera e guarda dez códigos novos (só o hash fica no banco). Devolve os códigos para mostrar uma única vez. */
export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((code) => hashRecoveryCode(userId, code)));
  await getDb()
    .update(users)
    .set({ totpRecoveryCodes: hashes.join(",") })
    .where(eq(users.id, userId));
  return codes;
}

export function recoveryCodesLeft(user: Pick<User, "totpRecoveryCodes">): number {
  return user.totpRecoveryCodes ? user.totpRecoveryCodes.split(",").filter(Boolean).length : 0;
}

/**
 * Confere o código do app (sem deixar reusar o mesmo código) ou um código de recuperação (que é gasto).
 * Devolve como a pessoa passou, ou null.
 */
export async function checkSecondFactor(
  user: Pick<User, "id" | "totpSecret" | "totpRecoveryCodes">,
  input: string,
): Promise<"totp" | "recuperacao" | null> {
  const secret = await openTotpSecret(user);
  // Só números (6) = código do app; letras e números (10) = código de recuperação.
  if (secret && /^\d{6}$/.test(input.replace(/[\s-]/g, ""))) {
    const counter = await verifyTotp(secret, input);
    if (counter !== null) {
      // Cada código só vale uma vez (alguém que viu o código na tela não consegue reaproveitar).
      return (await takeRateLimit(`totp-usado:${user.id}:${counter}`, 1, 5 * 60_000)) ? "totp" : null;
    }
    return null;
  }

  const code = normalizeRecoveryCode(input);
  if (!code) return null;
  const hash = await hashRecoveryCode(user.id, code);
  const stored = user.totpRecoveryCodes.split(",").filter(Boolean);
  if (!stored.includes(hash)) return null;
  // Gasta o código só se a lista não mudou desde a leitura (dois usos ao mesmo tempo não passam).
  const updated = await getDb()
    .update(users)
    .set({ totpRecoveryCodes: stored.filter((value) => value !== hash).join(",") })
    .where(and(eq(users.id, user.id), eq(users.totpRecoveryCodes, user.totpRecoveryCodes)))
    .returning({ id: users.id });
  return updated.length ? "recuperacao" : null;
}

/** Depois da senha (ou do Google), guarda um desafio de 10 minutos e manda a pessoa para a tela do código. */
export async function startLoginChallenge(userId: string, method: ChallengeMethod, next = ""): Promise<void> {
  const token = randomToken();
  const db = getDb();
  const now = new Date().toISOString();
  await db.delete(loginChallenges).where(lt(loginChallenges.expiresAt, now));
  await db.insert(loginChallenges).values({
    id: await sha256Hex(token),
    userId,
    method,
    next: next.slice(0, 300),
    expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60_000).toISOString(),
  });
  (await cookies()).set(TWO_FACTOR_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: BASE_PATH,
    maxAge: CHALLENGE_MINUTES * 60,
  });
}

/** Desafio ativo deste navegador, com a conta. */
export async function currentChallenge() {
  const token = (await cookies()).get(TWO_FACTOR_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({ challenge: loginChallenges, user: users })
    .from(loginChallenges)
    .innerJoin(users, eq(users.id, loginChallenges.userId))
    .where(and(eq(loginChallenges.id, await sha256Hex(token)), gt(loginChallenges.expiresAt, new Date().toISOString())))
    .limit(1);
  return row ?? null;
}

export async function endChallenge(id: string): Promise<void> {
  await getDb().delete(loginChallenges).where(eq(loginChallenges.id, id));
  (await cookies()).delete({ name: TWO_FACTOR_COOKIE, path: BASE_PATH });
}

/** Conta uma tentativa errada. Devolve true se ainda pode tentar de novo. */
export async function failChallenge(id: string, attempts: number): Promise<boolean> {
  if (attempts + 1 >= MAX_CHALLENGE_ATTEMPTS) {
    await endChallenge(id);
    return false;
  }
  await getDb()
    .update(loginChallenges)
    .set({ attempts: attempts + 1 })
    .where(eq(loginChallenges.id, id));
  return true;
}
