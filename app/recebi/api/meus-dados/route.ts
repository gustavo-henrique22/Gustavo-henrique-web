import { getCurrentUser } from "@/lib/recebi/auth";
import { todayISO } from "@/lib/recebi/dates";
import { exportUserData } from "@/lib/recebi/privacy";
import { takeRateLimit } from "@/lib/recebi/rate-limit";
import { hasRecentAuth } from "@/lib/recebi/reauth";
import { logSecurityEvent } from "@/lib/recebi/security";

export const dynamic = "force-dynamic";

/** Baixa um arquivo JSON com todos os dados da conta (LGPD). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Entre na sua conta para baixar seus dados.", { status: 401 });
  // Todos os dados da conta: só com identidade confirmada há poucos minutos.
  if (!(await hasRecentAuth())) return new Response("Confirme sua identidade antes de baixar seus dados.", { status: 403 });
  if (!(await takeRateLimit(`export:${user.id}`, 10, 86_400_000))) {
    return new Response("Você já baixou seus dados várias vezes hoje. Tente amanhã.", { status: 429 });
  }
  const data = await exportUserData(user);
  await logSecurityEvent(user.id, "dados-exportados");
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="recebi-meus-dados-${todayISO()}.json"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
