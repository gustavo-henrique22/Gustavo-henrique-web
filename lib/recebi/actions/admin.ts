"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { createPasswordReset, normalizeEmail, requireAdmin } from "../auth";
import { extendPro } from "../billing";
import { APP_PATH, BASE_PATH } from "../config";
import { assignExternalPayment } from "../external-billing";
import { siteOrigin } from "../origin";

export async function setUserPlan(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const userId = text(formData, "userId", 64);
  const months = Number(text(formData, "months", 3));
  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return fail("Usuário não encontrado.");

  if (!months) {
    await db.update(users).set({ plan: "free", planExpiresAt: null }).where(eq(users.id, userId));
    revalidatePath(APP_PATH, "layout");
    return success(`${target.email} voltou para o plano Grátis.`);
  }
  if (![1, 3, 6, 12].includes(months)) return fail("Período inválido.");

  const expires = await extendPro(target, months);
  revalidatePath(APP_PATH, "layout");
  return success(`Pro ativado para ${target.email} até ${expires.split("-").reverse().join("/")}.`);
}

export async function createResetLink(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const userId = text(formData, "userId", 64);
  const [target] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return fail("Usuário não encontrado.");
  const token = await createPasswordReset(target.id);
  return success(`${await siteOrigin()}${BASE_PATH}/redefinir-senha/${token}`);
}

/** Admin: vincula um pagamento externo sem conta à conta com o e-mail informado. */
export async function adminAssignPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const email = normalizeEmail(text(formData, "email", 200));
  const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return fail("Não existe conta com esse e-mail.");
  if (!(await assignExternalPayment(text(formData, "id", 64), user))) return fail("Esse pagamento já foi vinculado.");
  revalidatePath(APP_PATH, "layout");
  return success(`Pro liberado para ${user.email}.`);
}
