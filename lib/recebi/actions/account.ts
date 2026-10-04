"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { lockLink } from "../account-lock";
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
import { escapeHtml } from "../email";
import { sendEmailVerification } from "../email-verification";
import { LOGO_TYPES, removeFile, removeUserFiles, storeUpload } from "../files";
import { parseMoney } from "../money";
import { passwordProblem } from "../password-policy";
import { takeRateLimit } from "../rate-limit";
import { hasRecentAuth } from "../reauth";
import { sendAccountDeletedEmail, sendPasswordChangedEmail, sendSecurityAlertEmail } from "../notifications";
import { logSecurityEvent } from "../security";
import { sealUser } from "../sensitive";
import { checkSecondFactor, twoFactorEnabled } from "../two-factor";

function refresh() {
  revalidatePath(APP_PATH, "layout");
}

const DEMO_BLOCKED = "Na demonstração não dá para mudar isso. Crie sua conta grátis para usar de verdade.";

/**
 * Trocar o e-mail ou a chave Pix é o que um invasor faria primeiro (desviar pagamentos ou tomar a conta).
 * Exige o código do app (se a verificação em duas etapas está ativa), senão a senha atual, senão identidade
 * confirmada há pouco (contas só com Google). Devolve a mensagem de erro, ou null se pode seguir.
 */
async function confirmSensitiveChange(user: User, formData: FormData): Promise<string | null> {
  if (!(await takeRateLimit(`troca-sensivel:${user.id}`, 10, 3_600_000))) return "Muitas tentativas. Tente de novo em uma hora.";
  if (twoFactorEnabled(user)) {
    if (await checkSecondFactor(user, text(formData, "confirmCode", 20))) return null;
    await logSecurityEvent(user.id, "login-2fa-falhou", "Troca de e-mail ou chave Pix");
    return "Para trocar o e-mail ou a chave Pix, digite o código atual do app autenticador.";
  }
  if (user.passwordHash !== GOOGLE_ONLY_PASSWORD) {
    if (await verifyPassword(String(formData.get("confirmPassword") ?? ""), user.passwordHash)) return null;
    return "Para trocar o e-mail ou a chave Pix, digite sua senha atual.";
  }
  return (await hasRecentAuth()) ? null : "Para trocar o e-mail ou a chave Pix, confirme sua identidade entrando de novo com o Google.";
}

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.isDemo) return fail(DEMO_BLOCKED);
  const name = text(formData, "name", 120);
  const email = normalizeEmail(text(formData, "email", 200));
  if (!name) return fail("Informe seu nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("E-mail inválido.");

  const db = getDb();
  if (email !== user.email) {
    const blocked = await confirmSensitiveChange(user, formData);
    if (blocked) return fail(blocked);
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
      // CPF/CNPJ e telefone ficam criptografados no banco.
      ...(await sealUser(user.id, { document: text(formData, "document", 30), phone: text(formData, "phone", 40) })),
      // Um e-mail novo precisa ser confirmado de novo.
      ...(email !== user.email ? { emailVerifiedAt: null } : {}),
    })
    .where(eq(users.id, user.id));
  if (email !== user.email) {
    await logSecurityEvent(user.id, "email-alterado", `${user.email} → ${email}`);
    await sendEmailVerification({ ...user, name, email, emailVerifiedAt: null });
    // Aviso para o e-mail ANTIGO, com o botão de bloquear a conta.
    await sendSecurityAlertEmail(user, {
      subject: "O e-mail da sua conta do Recebi foi trocado",
      title: "E-mail da conta trocado",
      lines: [`O e-mail da sua conta foi trocado para <strong>${escapeHtml(email)}</strong>.`],
      lockUrl: await lockLink(user.id),
    });
  }
  refresh();
  return success("Perfil atualizado.");
}

export async function updatePaymentSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const pixKey = text(formData, "pixKey", 100);
  const city = text(formData, "city", 60);
  if (pixKey && !city) return fail("Informe sua cidade. Ela é obrigatória no QR Code do Pix.");
  const pixChanged = pixKey !== user.pixKey;
  if (pixChanged && user.pixKey) {
    if (user.isDemo) return fail(DEMO_BLOCKED);
    const blocked = await confirmSensitiveChange(user, formData);
    if (blocked) return fail(blocked);
  }
  await getDb()
    .update(users)
    .set({ ...(await sealUser(user.id, { pixKey })), city })
    .where(eq(users.id, user.id));
  // Trocar a chave Pix desvia os pagamentos: fica registrado na atividade de segurança.
  if (pixChanged) {
    await logSecurityEvent(user.id, "chave-pix-alterada");
    if (user.pixKey) {
      await sendSecurityAlertEmail(user, {
        subject: "A chave Pix da sua conta do Recebi foi trocada",
        title: "Chave Pix trocada",
        lines: ["A chave Pix que aparece nas suas cobranças foi trocada. Os próximos pagamentos vão para a chave nova."],
        lockUrl: await lockLink(user.id),
      });
    }
  }
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
  if (!(await takeRateLimit(`senha-atual:${user.id}`, 10, 3_600_000))) return fail("Muitas tentativas. Tente de novo em uma hora.");
  if (!googleOnly && !(await verifyPassword(current, user.passwordHash))) return fail("A senha atual está incorreta.");
  const problem = await passwordProblem(next, user);
  if (problem) return fail(problem);
  if (!googleOnly && current === next) return fail("A nova senha precisa ser diferente da atual.");

  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, user.id));
  await destroyOtherSessions(user.id);
  await logSecurityEvent(user.id, "senha-alterada");
  await sendPasswordChangedEmail(user);
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
  if (text(formData, "confirm", 20).toUpperCase() !== "EXCLUIR") return fail("Digite EXCLUIR para confirmar.");
  if (!(await takeRateLimit(`senha-atual:${user.id}`, 10, 3_600_000))) return fail("Muitas tentativas. Tente de novo em uma hora.");
  if (user.passwordHash !== GOOGLE_ONLY_PASSWORD && !(await verifyPassword(password, user.passwordHash))) return fail("Senha incorreta.");
  await destroySession();
  await removeUserFiles(user.id);
  await getDb().delete(users).where(eq(users.id, user.id));
  await sendAccountDeletedEmail(user);
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

export async function updateMonthlySummary(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const enabled = text(formData, "monthlySummary") === "on";
  await getDb().update(users).set({ monthlySummary: enabled }).where(eq(users.id, user.id));
  refresh();
  return success(enabled ? "Você vai receber o resumo todo mês." : "Resumo do mês desligado.");
}

export async function updateHourlyRate(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const input = text(formData, "hourlyRate", 30);
  const cents = input ? parseMoney(input) : 0;
  if (cents === null || cents < 0 || cents > 10_000_000) return fail("Valor da hora inválido.");
  await getDb().update(users).set({ hourlyRateCents: cents }).where(eq(users.id, user.id));
  refresh();
  return success("Valor da hora atualizado.");
}

export async function dismissOnboarding(): Promise<ActionState> {
  const user = await requireUser();
  await getDb().update(users).set({ onboardingDismissedAt: new Date().toISOString() }).where(eq(users.id, user.id));
  refresh();
  return success("Guia escondido. Você encontra tudo no menu.");
}
