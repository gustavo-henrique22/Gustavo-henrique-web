// Proteções do painel de administração: só entra quem é admin, tem verificação em duas etapas
// (código do app ou chave de acesso) e confirmou a identidade há pouco. Tudo o que o admin faz fica registrado.
import { count, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { adminAudit, passkeys, type User } from "@/db/schema";
import { requireAdmin } from "./auth";
import { APP_PATH } from "./config";
import { hasRecentAuth, REAUTH_MESSAGE, requireRecentAuth } from "./reauth";
import { requestMeta } from "./security";

export const ADMIN_2FA_PATH = `${APP_PATH}/configuracoes/seguranca?admin=1#duas-etapas`;

/** Verificação forte: código do app (TOTP) ou chave de acesso cadastrada. */
export async function hasStrongSecondFactor(user: Pick<User, "id" | "totpEnabledAt">): Promise<boolean> {
  if (user.totpEnabledAt) return true;
  const [{ total }] = await getDb().select({ total: count() }).from(passkeys).where(eq(passkeys.userId, user.id));
  return total > 0;
}

/** Para a página de admin. */
export async function requireAdminPage(next: string): Promise<User> {
  const admin = await requireAdmin();
  if (!(await hasStrongSecondFactor(admin))) redirect(ADMIN_2FA_PATH);
  await requireRecentAuth(next);
  return admin;
}

/** Para ações de admin: devolve o admin ou a mensagem de erro. */
export async function requireAdminAction(): Promise<{ admin: User; error: null } | { admin: null; error: string }> {
  const admin = await requireAdmin();
  if (!(await hasStrongSecondFactor(admin))) {
    return { admin: null, error: "Ative a verificação em duas etapas para usar a administração." };
  }
  if (!(await hasRecentAuth())) return { admin: null, error: REAUTH_MESSAGE };
  return { admin, error: null };
}

export async function logAdminAction(admin: Pick<User, "id" | "email">, action: string, targetEmail = "", detail = "") {
  const { ip } = await requestMeta();
  await getDb()
    .insert(adminAudit)
    .values({
      id: crypto.randomUUID(),
      adminId: admin.id,
      adminEmail: admin.email,
      action,
      targetEmail,
      detail: detail.slice(0, 300),
      ip,
    });
}

export const ADMIN_ACTION_LABELS: Record<string, string> = {
  "plano-pro": "Deu Pro",
  "plano-gratis": "Voltou para o Grátis",
  "link-senha": "Gerou link de nova senha",
  "pagamento-vinculado": "Vinculou pagamento",
  "backup-baixado": "Baixou cópia de segurança",
  "cupom-criado": "Criou cupom",
  "cupom-ativado": "Ativou cupom",
  "cupom-desativado": "Desativou cupom",
};

export async function listAdminAudit(limit = 30) {
  return getDb().select().from(adminAudit).orderBy(desc(adminAudit.createdAt)).limit(limit);
}
