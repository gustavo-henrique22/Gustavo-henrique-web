import { claimDay, runDailyTasks } from "@/lib/recebi/daily-tasks";
import { readEnv } from "@/lib/recebi/email";

export const dynamic = "force-dynamic";

/**
 * Tarefas automáticas do dia (veja lib/recebi/daily-tasks.ts). Elas já rodam sozinhas na primeira visita do dia;
 * esta rota é um reforço opcional para um agendador externo (ex.: cron-job.org):
 * https://SEU-SITE/recebi/api/lembretes?chave=VALOR_DE_RECEBI_CRON_SECRET
 */
async function run(request: Request) {
  const secret = readEnv("RECEBI_CRON_SECRET");
  if (!secret) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const provided = url.searchParams.get("chave") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) return new Response("Não autorizado", { status: 401 });
  // Marca o dia como feito: a execução automática não repete o trabalho.
  await claimDay();
  return Response.json({ ok: true, ...(await runDailyTasks()) });
}

export const GET = run;
export const POST = run;
