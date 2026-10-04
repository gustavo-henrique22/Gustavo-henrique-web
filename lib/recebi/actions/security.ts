"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { currentSessionId, requireActor } from "../auth";
import { APP_PATH } from "../config";
import { emailEnabled } from "../email";
import { sendEmailVerification } from "../email-verification";
import { takeRateLimit } from "../rate-limit";
import { logSecurityEvent } from "../security";

function refresh() {
  revalidatePath(`${APP_PATH}/configuracoes/seguranca`);
}

export async function resendVerificationEmail(): Promise<ActionState> {
  const user = await requireActor();
  if (user.emailVerifiedAt) return success("Seu e-mail já está confirmado.");
  if (!emailEnabled()) return fail("O envio de e-mails ainda não está ativo neste site.");
  if (!(await takeRateLimit(`verify:${user.id}`, 3, 3_600_000))) return fail("Você já pediu alguns links. Tente de novo em uma hora.");
  await sendEmailVerification(user);
  return success(`Enviamos um link para ${user.email}. Confira também a caixa de spam.`);
}

export async function revokeSession(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireActor();
  const id = text(formData, "id", 128);
  if (id === (await currentSessionId())) return fail("Para sair deste aparelho, use o botão Sair.");
  const removed = await getDb()
    .delete(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
    .returning({ id: sessions.id });
  if (removed.length === 0) return fail("Sessão não encontrada.");
  await logSecurityEvent(user.id, "sessao-encerrada");
  refresh();
  return success("Aparelho desconectado.");
}

export async function revokeOtherSessions(): Promise<ActionState> {
  const user = await requireActor();
  const current = (await currentSessionId()) ?? "";
  const removed = await getDb()
    .delete(sessions)
    .where(and(eq(sessions.userId, user.id), ne(sessions.id, current)))
    .returning({ id: sessions.id });
  await logSecurityEvent(user.id, "sessoes-encerradas", `${removed.length} aparelhos`);
  refresh();
  return success(removed.length ? `${removed.length} aparelho(s) desconectado(s).` : "Nenhum outro aparelho conectado.");
}
