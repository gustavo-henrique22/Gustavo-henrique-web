"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { loginAttempts, passwordResets, users } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import {
  createPasswordReset,
  getCurrentUser,
  GOOGLE_ONLY_PASSWORD,
  destroyAllSessions,
  destroySession,
  findValidPasswordReset,
  hashPassword,
  isAdminEmail,
  normalizeEmail,
  verifyPassword,
} from "../auth";
import { APP_PATH, BASE_PATH } from "../config";
import { emailEnabled } from "../email";
import { verificationLink } from "../email-verification";
import { completeLogin } from "../login";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../notifications";
import { siteOrigin } from "../origin";
import { applyReferral, REFERRAL_COOKIE } from "../referral";
import { logSecurityEvent } from "../security";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILURES = 8;
const LOCK_MINUTES = 15;

function checkPassword(password: string): string | null {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (password.length > 200) return "A senha é longa demais.";
  return null;
}

function safeNext(value: string): string {
  return value.startsWith(`${APP_PATH}`) && !value.startsWith("//") ? value : APP_PATH;
}

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  const name = text(formData, "name", 120);
  const email = normalizeEmail(text(formData, "email", 200));
  const password = String(formData.get("password") ?? "");
  const businessName = text(formData, "businessName", 120);

  if (!name) return fail("Informe seu nome.");
  if (!EMAIL_RE.test(email)) return fail("Informe um e-mail válido.");
  const passwordError = checkPassword(password);
  if (passwordError) return fail(passwordError);
  if (formData.get("terms") !== "on") return fail("Você precisa aceitar os termos de uso.");

  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return fail("Já existe uma conta com este e-mail. Tente entrar.");

  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    name,
    email,
    businessName,
    passwordHash: await hashPassword(password),
    isAdmin: await isAdminEmail(email),
  });
  // Convite: código do formulário ou do cookie deixado pelo link /recebi/convite/<código>.
  const jar = await cookies();
  const referralCode = text(formData, "ref", 20) || jar.get(REFERRAL_COOKIE)?.value || "";
  if (referralCode) {
    await applyReferral({ id, name, email }, referralCode);
    jar.delete({ name: REFERRAL_COOKIE, path: BASE_PATH });
  }
  await completeLogin({ id, name, email, isDemo: false }, "cadastro");
  await sendWelcomeEmail({ name, email }, emailEnabled() ? await verificationLink(id) : undefined);
  redirect(`${APP_PATH}?bem-vindo=1`);
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalizeEmail(text(formData, "email", 200));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return fail("Informe e-mail e senha.");

  const db = getDb();
  // Bloqueia temporariamente depois de muitas tentativas erradas para o mesmo e-mail.
  const windowStart = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString().replace("T", " ").slice(0, 19);
  const [{ failures }] = await db
    .select({ failures: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, email), gte(loginAttempts.createdAt, windowStart)));
  if (failures >= MAX_FAILURES) {
    return fail(`Muitas tentativas erradas. Aguarde ${LOCK_MINUTES} minutos ou redefina sua senha.`);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Mesmo sem usuário, calculamos um hash para não revelar quais e-mails existem pelo tempo de resposta.
  const valid = user ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false);
  if (!user || !valid) {
    await db.insert(loginAttempts).values({ id: crypto.randomUUID(), email });
    if (user && !user.isDemo) await logSecurityEvent(user.id, "login-falhou");
    if (user?.passwordHash === GOOGLE_ONLY_PASSWORD) return fail("Esta conta usa o login com Google. Clique em “Entrar com Google”.");
    return fail("E-mail ou senha incorretos.");
  }

  await db.delete(loginAttempts).where(eq(loginAttempts.email, email));
  await completeLogin(user, "senha");
  redirect(safeNext(text(formData, "next", 300)));
}

export async function signOut(): Promise<void> {
  const user = await getCurrentUser();
  if (user && !user.isDemo) await logSecurityEvent(user.id, "logout");
  await destroySession();
  redirect(`${BASE_PATH}/entrar`);
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalizeEmail(text(formData, "email", 200));
  if (!EMAIL_RE.test(email)) return fail("Informe um e-mail válido.");
  if (!emailEnabled()) {
    return fail("O envio automático de e-mails ainda não está ativo. Fale com o suporte pelo WhatsApp para receber seu link.");
  }

  const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  if (user && !user.isDemo) {
    const token = await createPasswordReset(user.id);
    const link = `${await siteOrigin()}${BASE_PATH}/redefinir-senha/${token}`;
    await sendPasswordResetEmail(user, link);
  }
  return success("Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.");
}

export async function resetPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const token = text(formData, "token", 200);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const passwordError = checkPassword(password);
  if (passwordError) return fail(passwordError);
  if (password !== confirm) return fail("As senhas não conferem.");

  const reset = await findValidPasswordReset(token);
  if (!reset) return fail("Este link expirou ou já foi usado. Peça um novo.");

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, reset.userId)).limit(1);
  if (!user) return fail("Este link expirou ou já foi usado. Peça um novo.");
  await db
    .update(users)
    // Quem recebeu o link no e-mail provou que o e-mail é seu.
    .set({ passwordHash: await hashPassword(password), emailVerifiedAt: user.emailVerifiedAt ?? new Date().toISOString() })
    .where(eq(users.id, reset.userId));
  await db.update(passwordResets).set({ usedAt: new Date().toISOString() }).where(eq(passwordResets.id, reset.id));
  await destroyAllSessions(reset.userId);
  await logSecurityEvent(reset.userId, "senha-redefinida");
  await completeLogin(user, "redefinicao");
  redirect(APP_PATH);
}
