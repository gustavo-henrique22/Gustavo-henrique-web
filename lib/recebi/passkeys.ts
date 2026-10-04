// Chaves de acesso (passkeys / WebAuthn): entrar com digital, rosto ou PIN do aparelho, sem senha.
// A chave privada nunca sai do aparelho; guardamos só a chave pública. Resiste a sites falsos (phishing).
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { and, asc, eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { passkeyChallenges, passkeys, users, type Passkey, type User } from "@/db/schema";
import { BASE_PATH } from "./config";
import { randomToken, sha256Hex } from "./crypto";
import { siteOrigin } from "./origin";

const CHALLENGE_COOKIE = "recebi_pk";
const CHALLENGE_MINUTES = 5;
export const MAX_PASSKEYS = 10;

type Purpose = "registro" | "login" | "confirmar";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function relyingParty() {
  const origin = await siteOrigin();
  return { origin, rpID: new URL(origin).hostname };
}

async function saveChallenge(purpose: Purpose, challenge: string, userId: string | null) {
  const token = randomToken();
  const db = getDb();
  const now = new Date().toISOString();
  await db.delete(passkeyChallenges).where(lt(passkeyChallenges.expiresAt, now));
  await db.insert(passkeyChallenges).values({
    id: await sha256Hex(token),
    userId,
    purpose,
    challenge,
    expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60_000).toISOString(),
  });
  (await cookies()).set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: BASE_PATH,
    maxAge: CHALLENGE_MINUTES * 60,
  });
}

/** Lê e apaga o desafio deste navegador (cada desafio vale uma vez só). */
async function takeChallenge(purpose: Purpose, userId: string | null): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  jar.delete({ name: CHALLENGE_COOKIE, path: BASE_PATH });
  const [row] = await getDb()
    .delete(passkeyChallenges)
    .where(eq(passkeyChallenges.id, await sha256Hex(token)))
    .returning();
  if (!row || row.purpose !== purpose || row.expiresAt < new Date().toISOString()) return null;
  if (userId !== null && row.userId !== userId) return null;
  return row.challenge;
}

export async function listPasskeys(userId: string): Promise<Passkey[]> {
  return getDb().select().from(passkeys).where(eq(passkeys.userId, userId)).orderBy(asc(passkeys.createdAt));
}

/** Passo 1 do cadastro: opções para o navegador criar a chave. */
export async function registrationOptions(user: Pick<User, "id" | "email" | "name">): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpID } = await relyingParty();
  const existing = await listPasskeys(user.id);
  const options = await generateRegistrationOptions({
    rpName: "Recebi",
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((key) => ({
      id: key.id,
      transports: key.transports ? (key.transports.split(",") as AuthenticatorTransport[]) : undefined,
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  await saveChallenge("registro", options.challenge, user.id);
  return options;
}

/** Passo 2 do cadastro: confere a resposta do aparelho e guarda a chave pública. */
export async function finishRegistration(user: Pick<User, "id">, response: RegistrationResponseJSON, name: string): Promise<boolean> {
  const challenge = await takeChallenge("registro", user.id);
  if (!challenge) return false;
  const { origin, rpID } = await relyingParty();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return false;
  }
  if (!verification.verified || !verification.registrationInfo) return false;
  const { credential } = verification.registrationInfo;
  await getDb()
    .insert(passkeys)
    .values({
      id: credential.id,
      userId: user.id,
      publicKey: toBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: (credential.transports ?? []).join(","),
      name: name.slice(0, 60) || "Chave de acesso",
    })
    .onConflictDoNothing();
  return true;
}

/** Opções para entrar (login sem e-mail) ou para confirmar a identidade de quem já está logado. */
export async function authenticationOptions(
  purpose: "login" | "confirmar",
  userId: string | null,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = await relyingParty();
  const allow = userId ? await listPasskeys(userId) : [];
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: allow.map((key) => ({
      id: key.id,
      transports: key.transports ? (key.transports.split(",") as AuthenticatorTransport[]) : undefined,
    })),
  });
  await saveChallenge(purpose, options.challenge, userId);
  return options;
}

/** Confere a assinatura do aparelho. Devolve a conta dona da chave, ou null. */
export async function finishAuthentication(
  purpose: "login" | "confirmar",
  userId: string | null,
  response: AuthenticationResponseJSON,
): Promise<User | null> {
  const challenge = await takeChallenge(purpose, userId);
  if (!challenge || typeof response?.id !== "string") return null;
  const db = getDb();
  const [row] = await db
    .select({ key: passkeys, user: users })
    .from(passkeys)
    .innerJoin(users, eq(users.id, passkeys.userId))
    .where(eq(passkeys.id, response.id))
    .limit(1);
  if (!row || (userId !== null && row.user.id !== userId)) return null;
  const { origin, rpID } = await relyingParty();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: row.key.id,
        publicKey: fromBase64Url(row.key.publicKey),
        counter: row.key.counter,
        transports: row.key.transports ? row.key.transports.split(",") : undefined,
      },
    });
  } catch {
    return null;
  }
  if (!verification.verified) return null;
  await db
    .update(passkeys)
    .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() })
    .where(and(eq(passkeys.id, row.key.id), eq(passkeys.userId, row.user.id)));
  return row.user;
}
