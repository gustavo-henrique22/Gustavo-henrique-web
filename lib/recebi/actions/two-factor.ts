"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { destroyOtherSessions, GOOGLE_ONLY_PASSWORD, requireUser, verifyPassword } from "../auth";
import { APP_PATH, BASE_PATH } from "../config";
import { completeLogin } from "../login";
import { sendTwoFactorEmail } from "../notifications";
import { takeRateLimit } from "../rate-limit";
import { logSecurityEvent } from "../security";
import { generateTotpSecret, verifyTotp } from "../totp";
import {
  checkSecondFactor,
  currentChallenge,
  endChallenge,
  failChallenge,
  issueRecoveryCodes,
  openTotpSecret,
  sealTotpSecret,
  twoFactorEnabled,
} from "../two-factor";

const SECURITY_PATH = `${APP_PATH}/configuracoes/seguranca`;

/** Passo 1: cria um segredo novo (ainda não vale para o login) e mostra o QR Code. */
export async function beginTwoFactorSetup(): Promise<ActionState> {
  const user = await requireUser();
  if (user.isDemo) return fail("Crie sua conta para ativar a verificação em duas etapas.");
  if (twoFactorEnabled(user)) return fail("A verificação em duas etapas já está ativa.");
  const secret = generateTotpSecret();
  await getDb()
    .update(users)
    .set({ totpSecret: await sealTotpSecret(user.id, secret) })
    .where(eq(users.id, user.id));
  revalidatePath(SECURITY_PATH);
  return success();
}

export async function cancelTwoFactorSetup(): Promise<ActionState> {
  const user = await requireUser();
  if (twoFactorEnabled(user)) return fail("A verificação já está ativa.");
  await getDb().update(users).set({ totpSecret: null }).where(eq(users.id, user.id));
  revalidatePath(SECURITY_PATH);
  return success();
}

/** Passo 2: a pessoa digita o código do app. Se bater, liga a verificação e devolve os códigos de recuperação. */
export async function confirmTwoFactorSetup(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.isDemo) return fail("Crie sua conta para ativar a verificação em duas etapas.");
  if (twoFactorEnabled(user)) return fail("A verificação em duas etapas já está ativa.");
  if (!(await takeRateLimit(`2fa-setup:${user.id}`, 10, 3_600_000))) return fail("Muitas tentativas. Tente de novo em uma hora.");
  const secret = await openTotpSecret(user);
  if (!secret) return fail("Comece de novo: clique em “Ativar”.");
  if ((await verifyTotp(secret, text(formData, "code", 20))) === null) {
    return fail("Código incorreto. Confira se o horário do celular está automático e digite o código atual.");
  }
  await getDb().update(users).set({ totpEnabledAt: new Date().toISOString() }).where(eq(users.id, user.id));
  const codes = await issueRecoveryCodes(user.id);
  // Quem estava conectado em outro aparelho entrou sem o código: sai.
  await destroyOtherSessions(user.id);
  await logSecurityEvent(user.id, "2fa-ativada");
  await sendTwoFactorEmail(user, true);
  return { ...success("Verificação em duas etapas ativada! 🔒"), codes };
}

/** Confere senha (quando a conta tem) e código antes de mudanças sensíveis na verificação. */
async function confirmIdentity(formData: FormData) {
  const user = await requireUser();
  if (!twoFactorEnabled(user)) return { user, error: "A verificação em duas etapas não está ativa." };
  if (!(await takeRateLimit(`2fa-gerenciar:${user.id}`, 10, 3_600_000)))
    return { user, error: "Muitas tentativas. Tente de novo em uma hora." };
  if (user.passwordHash !== GOOGLE_ONLY_PASSWORD && !(await verifyPassword(String(formData.get("password") ?? ""), user.passwordHash))) {
    return { user, error: "Senha incorreta." };
  }
  if (!(await checkSecondFactor(user, text(formData, "code", 20)))) {
    await logSecurityEvent(user.id, "login-2fa-falhou", "Configurações");
    return { user, error: "Código incorreto." };
  }
  return { user, error: null };
}

export async function disableTwoFactor(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, error } = await confirmIdentity(formData);
  if (error) return fail(error);
  await getDb().update(users).set({ totpSecret: null, totpEnabledAt: null, totpRecoveryCodes: "" }).where(eq(users.id, user.id));
  await logSecurityEvent(user.id, "2fa-desativada");
  await sendTwoFactorEmail(user, false);
  revalidatePath(SECURITY_PATH);
  return success("Verificação em duas etapas desativada.");
}

export async function regenerateRecoveryCodes(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, error } = await confirmIdentity(formData);
  if (error) return fail(error);
  const codes = await issueRecoveryCodes(user.id);
  await logSecurityEvent(user.id, "2fa-novos-codigos");
  return { ...success("Novos códigos gerados. Os antigos deixaram de valer."), codes };
}

/** Tela "Verificar acesso": segunda etapa do login. */
export async function verifyLoginCode(_: ActionState, formData: FormData): Promise<ActionState> {
  const row = await currentChallenge();
  if (!row) return fail("O tempo para digitar o código acabou. Entre de novo.");
  const { challenge, user } = row;
  // Limite por conta, além do limite por desafio: impede tentar milhares de códigos abrindo novos logins.
  if (!(await takeRateLimit(`2fa-login:${user.id}`, 15, 3_600_000))) {
    await endChallenge(challenge.id);
    return fail("Muitas tentativas. Por segurança, espere uma hora e entre de novo.");
  }
  const method = await checkSecondFactor(user, text(formData, "code", 20));
  if (!method) {
    await logSecurityEvent(user.id, "login-2fa-falhou");
    const canRetry = await failChallenge(challenge.id, challenge.attempts);
    return fail(canRetry ? "Código incorreto. Tente de novo." : "Muitas tentativas erradas. Entre de novo.");
  }
  await endChallenge(challenge.id);
  await completeLogin(user, method === "recuperacao" ? "recuperacao" : challenge.method === "google" ? "google" : "2fa");
  const next = challenge.next.startsWith(APP_PATH) && !challenge.next.startsWith("//") ? challenge.next : APP_PATH;
  redirect(next);
}

export async function cancelLoginChallenge(): Promise<void> {
  const row = await currentChallenge();
  if (row) await endChallenge(row.challenge.id);
  redirect(`${BASE_PATH}/entrar`);
}
