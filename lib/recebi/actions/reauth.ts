"use server";

import { redirect } from "next/navigation";
import { fail, text, type ActionState } from "../action-state";
import { lockAccount } from "../account-lock";
import { GOOGLE_ONLY_PASSWORD, requireActor, verifyPassword } from "../auth";
import { APP_PATH, BASE_PATH } from "../config";
import { takeRateLimit } from "../rate-limit";
import { markRecentAuth } from "../reauth";
import { logSecurityEvent } from "../security";
import { checkSecondFactor, twoFactorEnabled } from "../two-factor";

function safeNext(value: string): string {
  return value.startsWith(APP_PATH) && !value.startsWith("//") ? value : APP_PATH;
}

/** Tela "Confirme que é você": senha (se a conta tem) + código do app (se ativo). */
export async function confirmIdentity(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireActor();
  if (!(await takeRateLimit(`confirmar:${user.id}`, 10, 3_600_000))) return fail("Muitas tentativas. Tente de novo em uma hora.");
  const hasPassword = user.passwordHash !== GOOGLE_ONLY_PASSWORD;
  if (!hasPassword && !twoFactorEnabled(user)) {
    return fail("Sua conta entra pelo Google: use a chave de acesso ou entre de novo com o Google.");
  }
  if (hasPassword && !(await verifyPassword(String(formData.get("password") ?? ""), user.passwordHash))) {
    await logSecurityEvent(user.id, "login-falhou", "Confirmação de identidade");
    return fail("Senha incorreta.");
  }
  if (twoFactorEnabled(user) && !(await checkSecondFactor(user, text(formData, "code", 20)))) {
    await logSecurityEvent(user.id, "login-2fa-falhou", "Confirmação de identidade");
    return fail("Código incorreto.");
  }
  await markRecentAuth();
  await logSecurityEvent(user.id, "identidade-confirmada");
  redirect(safeNext(text(formData, "next", 300)));
}

/** Botão da página /bloquear-conta (o link do e-mail não faz nada sozinho: precisa do clique). */
export async function lockMyAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await lockAccount(text(formData, "token", 200)))) return fail("Este link expirou ou já foi usado.");
  redirect(`${BASE_PATH}/bloquear-conta/feito`);
}
