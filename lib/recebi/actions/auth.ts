"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { loginAttempts, passwordResets, users } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import {
  createPasswordReset,
  createSession,
  destroyAllSessions,
  destroySession,
  findValidPasswordReset,
  hashPassword,
  isAdminEmail,
  normalizeEmail,
  verifyPassword,
} from "../auth";
import { APP_PATH, BASE_PATH } from "../config";
import { emailEnabled, sendEmail } from "../email";
import { siteOrigin } from "../origin";

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
  await createSession(id);
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
    return fail("E-mail ou senha incorretos.");
  }

  await db.delete(loginAttempts).where(eq(loginAttempts.email, email));
  await createSession(user.id);
  redirect(safeNext(text(formData, "next", 300)));
}

export async function signOut(): Promise<void> {
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
  if (user) {
    const token = await createPasswordReset(user.id);
    const link = `${await siteOrigin()}${BASE_PATH}/redefinir-senha/${token}`;
    await sendEmail(
      user.email,
      "Redefinir sua senha do Recebi",
      `<p>Olá, ${user.name.replace(/[<>&]/g, "")}!</p><p>Para criar uma nova senha, acesse o link abaixo (válido por 24 horas):</p><p><a href="${link}">${link}</a></p><p>Se não foi você, ignore este e-mail.</p>`,
    );
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
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, reset.userId));
  await db.update(passwordResets).set({ usedAt: new Date().toISOString() }).where(eq(passwordResets.id, reset.id));
  await destroyAllSessions(reset.userId);
  await createSession(reset.userId);
  redirect(APP_PATH);
}
