"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { destroyOtherSessions, destroySession, hashPassword, normalizeEmail, requireUser, verifyPassword } from "../auth";
import { APP_PATH, BASE_PATH } from "../config";
import { parseMoney } from "../money";

function refresh() {
  revalidatePath(APP_PATH, "layout");
}

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = text(formData, "name", 120);
  const email = normalizeEmail(text(formData, "email", 200));
  if (!name) return fail("Informe seu nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("E-mail inválido.");

  const db = getDb();
  if (email !== user.email) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, user.id)))
      .limit(1);
    if (taken) return fail("Este e-mail já está em uso por outra conta.");
  }

  await db
    .update(users)
    .set({
      name,
      email,
      businessName: text(formData, "businessName", 120),
      document: text(formData, "document", 30),
      phone: text(formData, "phone", 40),
    })
    .where(eq(users.id, user.id));
  refresh();
  return success("Perfil atualizado.");
}

export async function updatePaymentSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const pixKey = text(formData, "pixKey", 100);
  const city = text(formData, "city", 60);
  if (pixKey && !city) return fail("Informe sua cidade. Ela é obrigatória no QR Code do Pix.");
  await getDb().update(users).set({ pixKey, city }).where(eq(users.id, user.id));
  refresh();
  return success("Dados de recebimento salvos.");
}

export async function updateFinanceSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const goalInput = text(formData, "monthlyGoal", 30);
  const limitInput = text(formData, "annualLimit", 30);
  const taxInput = text(formData, "taxRate", 10).replace("%", "").replace(",", ".");

  const monthlyGoalCents = goalInput ? parseMoney(goalInput) : 0;
  const annualLimitCents = limitInput ? parseMoney(limitInput) : 0;
  const taxRate = taxInput ? Number(taxInput) : 0;

  if (monthlyGoalCents === null || monthlyGoalCents < 0) return fail("Meta mensal inválida.");
  if (annualLimitCents === null || annualLimitCents < 0) return fail("Limite anual inválido.");
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 50) return fail("A alíquota precisa estar entre 0% e 50%.");

  await getDb()
    .update(users)
    .set({ monthlyGoalCents, annualLimitCents, taxRateBp: Math.round(taxRate * 100) })
    .where(eq(users.id, user.id));
  refresh();
  return success("Metas e impostos atualizados.");
}

export async function changePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) return fail("A senha atual está incorreta.");
  if (next.length < 8) return fail("A nova senha precisa ter pelo menos 8 caracteres.");

  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, user.id));
  await destroyOtherSessions(user.id);
  return success("Senha alterada. Outros aparelhos foram desconectados.");
}

export async function deleteAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  if (!(await verifyPassword(password, user.passwordHash))) return fail("Senha incorreta.");
  await destroySession();
  await getDb().delete(users).where(eq(users.id, user.id));
  redirect(`${BASE_PATH}?conta-excluida=1`);
}
