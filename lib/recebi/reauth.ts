// "Confirme que é você": telas e ações sensíveis (admin, chaves de acesso, baixar todos os dados...) exigem que a
// identidade tenha sido confirmada nos últimos minutos nesta sessão — senha (e código do app, se ativo), chave de
// acesso ou um login novo. Protege quem deixou o computador aberto ou teve a sessão roubada.
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { currentSessionId } from "./auth";
import { APP_PATH } from "./config";

export const REAUTH_MINUTES = 10;

/** A identidade foi confirmada há menos de REAUTH_MINUTES nesta sessão? */
export async function hasRecentAuth(): Promise<boolean> {
  const id = await currentSessionId();
  if (!id) return false;
  const [row] = await getDb().select({ reauthAt: sessions.reauthAt }).from(sessions).where(eq(sessions.id, id)).limit(1);
  return !!row?.reauthAt && Date.now() - Date.parse(row.reauthAt) < REAUTH_MINUTES * 60_000;
}

/** Marca a sessão atual como confirmada agora. */
export async function markRecentAuth(): Promise<void> {
  const id = await currentSessionId();
  if (id) await getDb().update(sessions).set({ reauthAt: new Date().toISOString() }).where(eq(sessions.id, id));
}

export function confirmPath(next: string): string {
  return `${APP_PATH}/confirmar-identidade?next=${encodeURIComponent(next)}`;
}

/** Para páginas: sem confirmação recente, manda para a tela de confirmação e volta depois. */
export async function requireRecentAuth(next: string): Promise<void> {
  if (!(await hasRecentAuth())) redirect(confirmPath(next));
}

export const REAUTH_MESSAGE = "Por segurança, confirme que é você antes de continuar.";
