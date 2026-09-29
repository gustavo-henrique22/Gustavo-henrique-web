"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import {
  destroyOtherSessions,
  destroySession,
  GOOGLE_ONLY_PASSWORD,
  hasPro,
  hashPassword,
  normalizeEmail,
  requireUser,
  verifyPassword,
} from "../auth";
import { APP_PATH, BASE_PATH } from "../config";
import { LOGO_TYPES, removeFile, removeUserFiles, storeUpload } from "../files";
import { parseMoney } from "../money";

function refresh() {
  revalidatePath(APP_PATH, "layout");
}

const DEMO_BLOCKED = "Na demonstração não dá para mudar isso. Crie sua conta grátis para usar de verdade.";

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.isDemo) return fail(DEMO_BLOCKED);
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
  if (user.isDemo) return fail(DEMO_BLOCKED);
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  // Contas criadas pelo Google ainda não têm senha: podem criar uma sem informar a atual.
  const googleOnly = user.passwordHash === GOOGLE_ONLY_PASSWORD;
  if (!googleOnly && !(await verifyPassword(current, user.passwordHash))) return fail("A senha atual está incorreta.");
  if (next.length < 8) return fail("A nova senha precisa ter pelo menos 8 caracteres.");

  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, user.id));
  await destroyOtherSessions(user.id);
  refresh();
  return success(
    googleOnly
      ? "Senha criada. Agora você também pode entrar com e-mail e senha."
      : "Senha alterada. Outros aparelhos foram desconectados.",
  );
}

export async function deleteAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.isDemo) return fail(DEMO_BLOCKED);
  const password = String(formData.get("password") ?? "");
  if (user.passwordHash === GOOGLE_ONLY_PASSWORD) {
    if (text(formData, "confirm", 20).toUpperCase() !== "EXCLUIR") return fail("Digite EXCLUIR para confirmar.");
  } else if (!(await verifyPassword(password, user.passwordHash))) return fail("Senha incorreta.");
  await destroySession();
  await removeUserFiles(user.id);
  await getDb().delete(users).where(eq(users.id, user.id));
  redirect(`${BASE_PATH}?conta-excluida=1`);
}

export async function uploadLogo(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.isDemo) return fail(DEMO_BLOCKED);
  if (!hasPro(user)) return fail("A logo nas cobranças é um recurso do plano Pro.");
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return fail("Escolha um arquivo de imagem.");
  if (file.size > 1024 * 1024) return fail("A logo pode ter no máximo 1 MB.");
  const stored = await storeUpload(`logos/${user.id}`, file, LOGO_TYPES);
  if ("error" in stored) return fail(stored.error.replace("PDF", "SVG"));
  await getDb().update(users).set({ logoKey: stored.key }).where(eq(users.id, user.id));
  await removeFile(user.logoKey);
  refresh();
  return success("Logo atualizada! Ela já aparece nas suas cobranças, orçamentos e recibos.");
}

export async function removeLogo(): Promise<ActionState> {
  const user = await requireUser();
  await getDb().update(users).set({ logoKey: null }).where(eq(users.id, user.id));
  await removeFile(user.logoKey);
  refresh();
  return success("Logo removida.");
}

export async function updateReminders(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const enabled = text(formData, "autoReminders") === "on";
  await getDb().update(users).set({ autoReminders: enabled }).where(eq(users.id, user.id));
  refresh();
  return success(enabled ? "Lembretes automáticos ativados." : "Lembretes automáticos desativados.");
}
