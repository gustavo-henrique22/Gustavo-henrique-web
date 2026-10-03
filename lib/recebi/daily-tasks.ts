// Tarefas automáticas do dia: cobranças recorrentes, lembretes, resumo do mês, notas fiscais pendentes e
// criptografia de dados antigos. Rodam sozinhas uma vez por dia, a partir das 7h (Brasília), na primeira visita
// ao Recebi — sem precisar de agendador externo. A rota /recebi/api/lembretes continua disponível como reforço.
import * as workers from "cloudflare:workers";
import { lt } from "drizzle-orm";
import { getDb } from "@/db";
import { externalPayments, loginAttempts } from "@/db/schema";
import { todayISO } from "./dates";
import { reencryptPending } from "./encryption-jobs";
import { refreshPendingNfse } from "./nfse";
import { sendDueReminders } from "./notifications";
import { generateDueRecurring } from "./recurring";
import { sqliteTimestamp } from "./rate-limit";
import { sendMonthlySummaries } from "./summary";

const START_HOUR = 7;

/** Uma tarefa com problema (ex.: e-mail fora do ar) não impede as outras. */
async function step<T>(name: string, task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch (error) {
    console.error(`tarefas-diarias:${name}`, error);
    return fallback;
  }
}

export async function runDailyTasks() {
  const recurring = await step("recorrentes", () => generateDueRecurring(), 0);
  const reminders = await step("lembretes", () => sendDueReminders(), { sent: 0, checked: 0 });
  const summaries = await step("resumos", () => sendMonthlySummaries(), 0);
  const nfse = await step("notas", () => refreshPendingNfse(), 0);
  const encrypted = await step("criptografia", () => reencryptPending(), 0);
  const removed = await step("limpeza", () => removeExpiredRecords(), 0);
  return { recurring, ...reminders, summaries, nfse, encrypted, removed };
}

/** Prazo da política de privacidade: avisos de pagamento ficam no máximo 5 anos. */
async function removeExpiredRecords(): Promise<number> {
  const limit = sqliteTimestamp(Date.now() - 5 * 365 * 86_400_000);
  const removed = await getDb()
    .delete(externalPayments)
    .where(lt(externalPayments.createdAt, limit))
    .returning({ id: externalPayments.id });
  return removed.length;
}

/** Marca o dia como feito. Só a primeira chamada do dia recebe true (chave única no banco). */
export async function claimDay(day = todayISO()): Promise<boolean> {
  const key = `tarefas-diarias:${day}`;
  const inserted = await getDb()
    .insert(loginAttempts)
    .values({ id: key, email: key })
    .onConflictDoNothing()
    .returning({ id: loginAttempts.id });
  return inserted.length > 0;
}

function brasiliaHour(): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(new Date()));
}

// Evita consultar o banco a cada visita: cada servidor confere no máximo uma vez por dia.
let checkedDay = "";

/** Chamado nas páginas do Recebi. Não atrasa a página: o trabalho continua depois da resposta. */
export function scheduleDailyTasks(): void {
  const day = todayISO();
  if (checkedDay === day || brasiliaHour() < START_HOUR) return;
  checkedDay = day;
  const work = (async () => {
    if (!(await claimDay(day))) return;
    await runDailyTasks();
  })().catch((error) => {
    console.error("tarefas-diarias", error);
  });
  const waitUntil = (workers as { waitUntil?: (promise: Promise<unknown>) => void }).waitUntil;
  if (typeof waitUntil === "function") waitUntil(work);
}
