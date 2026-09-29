import { readEnv } from "@/lib/recebi/email";
import { sendDueReminders } from "@/lib/recebi/notifications";

export const dynamic = "force-dynamic";

/**
 * Envia os lembretes de cobrança do dia. Chame uma vez por dia (ex.: pelo cron-job.org) com
 * https://SEU-SITE/recebi/api/lembretes?chave=VALOR_DE_RECEBI_CRON_SECRET
 */
async function run(request: Request) {
  const secret = readEnv("RECEBI_CRON_SECRET");
  if (!secret) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const provided = url.searchParams.get("chave") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) return new Response("Não autorizado", { status: 401 });
  const result = await sendDueReminders();
  return Response.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
