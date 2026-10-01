import { readEnv } from "@/lib/recebi/email";
import { reencryptPending } from "@/lib/recebi/encryption-jobs";
import { refreshPendingNfse } from "@/lib/recebi/nfse";
import { sendDueReminders } from "@/lib/recebi/notifications";
import { generateDueRecurring } from "@/lib/recebi/recurring";
import { sendMonthlySummaries } from "@/lib/recebi/summary";

export const dynamic = "force-dynamic";

/**
 * Tarefas automáticas do dia: cobranças recorrentes, lembretes de cobrança, resumo do mês, notas fiscais pendentes
 * e criptografia de dados antigos.
 * Chame uma vez por dia (ex.: pelo cron-job.org) com
 * https://SEU-SITE/recebi/api/lembretes?chave=VALOR_DE_RECEBI_CRON_SECRET
 */
async function run(request: Request) {
  const secret = readEnv("RECEBI_CRON_SECRET");
  if (!secret) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const provided = url.searchParams.get("chave") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) return new Response("Não autorizado", { status: 401 });
  const recurring = await generateDueRecurring();
  const reminders = await sendDueReminders();
  const summaries = await sendMonthlySummaries();
  const nfse = await refreshPendingNfse();
  const encrypted = await reencryptPending();
  return Response.json({ ok: true, recurring, ...reminders, summaries, nfse, encrypted });
}

export const GET = run;
export const POST = run;
