"use server";

import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { passkeys } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { lockLink } from "../account-lock";
import { requireUser } from "../auth";
import { APP_PATH } from "../config";
import { escapeHtml } from "../email";
import { completeLogin } from "../login";
import { sendSecurityAlertEmail } from "../notifications";
import {
  authenticationOptions,
  finishAuthentication,
  finishRegistration,
  listPasskeys,
  MAX_PASSKEYS,
  registrationOptions,
} from "../passkeys";
import { takeRateLimit } from "../rate-limit";
import { hasRecentAuth, markRecentAuth, REAUTH_MESSAGE } from "../reauth";
import { logSecurityEvent, requestMeta } from "../security";

const SECURITY_PATH = `${APP_PATH}/configuracoes/seguranca`;

type OptionsResult<T> = { ok: true; options: T } | { ok: false; error: string };

// ---------- Cadastrar uma chave (logado, com identidade confirmada há pouco) ----------

export async function startPasskeyRegistration(): Promise<OptionsResult<PublicKeyCredentialCreationOptionsJSON>> {
  const user = await requireUser();
  if (user.isDemo) return { ok: false, error: "Crie sua conta para usar chaves de acesso." };
  if (!(await hasRecentAuth())) return { ok: false, error: REAUTH_MESSAGE };
  if ((await listPasskeys(user.id)).length >= MAX_PASSKEYS) return { ok: false, error: `Limite de ${MAX_PASSKEYS} chaves de acesso.` };
  return { ok: true, options: await registrationOptions(user) };
}

export async function finishPasskeyRegistration(response: RegistrationResponseJSON, name: string): Promise<ActionState> {
  const user = await requireUser();
  if (!(await hasRecentAuth())) return fail(REAUTH_MESSAGE);
  const label = String(name ?? "")
    .trim()
    .slice(0, 60);
  if (!(await finishRegistration(user, response, label))) return fail("Não foi possível confirmar a chave. Tente de novo.");
  await logSecurityEvent(user.id, "passkey-adicionada", label);
  await sendSecurityAlertEmail(user, {
    subject: "Nova chave de acesso na sua conta do Recebi",
    title: "Chave de acesso adicionada",
    lines: [
      `Uma chave de acesso${label ? ` (“${escapeHtml(label)}”)` : ""} foi adicionada à sua conta. Com ela, dá para entrar sem senha.`,
    ],
    lockUrl: await lockLink(user.id),
  });
  revalidatePath(SECURITY_PATH);
  return success("Chave de acesso criada. Na próxima vez, entre com a digital ou o rosto. 🔑");
}

export async function removePasskey(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await hasRecentAuth())) return fail(REAUTH_MESSAGE);
  const removed = await getDb()
    .delete(passkeys)
    .where(and(eq(passkeys.id, text(formData, "id", 512)), eq(passkeys.userId, user.id)))
    .returning({ name: passkeys.name });
  if (removed.length === 0) return fail("Chave não encontrada.");
  await logSecurityEvent(user.id, "passkey-removida", removed[0].name);
  revalidatePath(SECURITY_PATH);
  return success("Chave de acesso removida.");
}

// ---------- Entrar com chave de acesso (sem senha) ----------

export async function startPasskeyLogin(): Promise<OptionsResult<PublicKeyCredentialRequestOptionsJSON>> {
  const { ip } = await requestMeta();
  if (ip && !(await takeRateLimit(`passkey-login:${ip}`, 30, 15 * 60_000))) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  }
  return { ok: true, options: await authenticationOptions("login", null) };
}

export async function finishPasskeyLogin(
  response: AuthenticationResponseJSON,
  next: string,
): Promise<{ ok: boolean; error?: string; redirect?: string }> {
  const user = await finishAuthentication("login", null, response);
  if (!user || user.isDemo) return { ok: false, error: "Não reconhecemos essa chave de acesso. Entre com e-mail e senha." };
  // A chave de acesso já é "duas etapas" (o aparelho + a digital/rosto/PIN): não pede o código do app.
  await completeLogin(user, "passkey");
  const safe = typeof next === "string" && next.startsWith(APP_PATH) && !next.startsWith("//") ? next : APP_PATH;
  return { ok: true, redirect: safe };
}

// ---------- Confirmar a identidade com a chave (telas sensíveis) ----------

export async function startPasskeyConfirm(): Promise<OptionsResult<PublicKeyCredentialRequestOptionsJSON>> {
  const user = await requireUser();
  if ((await listPasskeys(user.id)).length === 0) return { ok: false, error: "Você ainda não tem chave de acesso." };
  return { ok: true, options: await authenticationOptions("confirmar", user.id) };
}

export async function finishPasskeyConfirm(response: AuthenticationResponseJSON): Promise<ActionState> {
  const user = await requireUser();
  const owner = await finishAuthentication("confirmar", user.id, response);
  if (!owner) return fail("Não foi possível confirmar com a chave. Tente de novo ou use a senha.");
  await markRecentAuth();
  await logSecurityEvent(user.id, "identidade-confirmada", "chave de acesso");
  return success("Identidade confirmada.");
}
