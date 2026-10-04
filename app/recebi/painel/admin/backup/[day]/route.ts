import { hasStrongSecondFactor, logAdminAction } from "@/lib/recebi/admin-guard";
import { getCurrentUser } from "@/lib/recebi/auth";
import { BACKUP_PREFIX } from "@/lib/recebi/backup";
import { readFile } from "@/lib/recebi/files";
import { hasRecentAuth } from "@/lib/recebi/reauth";

export const dynamic = "force-dynamic";

/** Baixa uma cópia de segurança (continua criptografada; só abre com RECEBI_ENCRYPTION_KEY). */
export async function GET(_: Request, { params }: { params: Promise<{ day: string }> }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new Response("Não encontrado.", { status: 404 });
  if (!(await hasStrongSecondFactor(user)) || !(await hasRecentAuth())) {
    return new Response("Confirme sua identidade no painel de administração.", { status: 403 });
  }
  const { day } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Response("Não encontrado.", { status: 404 });
  const file = await readFile(`${BACKUP_PREFIX}${day}.json.enc`);
  if (!file) return new Response("Não encontrado.", { status: 404 });
  await logAdminAction(user, "backup-baixado", "", day);
  return new Response(file.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="recebi-backup-${day}.json.enc"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
