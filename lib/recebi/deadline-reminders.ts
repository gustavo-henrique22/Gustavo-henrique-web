// Lembretes do dia a dia, enviados pelas tarefas diárias:
// - DAS do MEI: no dia 15, para quem é MEI e ainda não lançou o DAS do mês (vence todo dia 20);
// - Prazo de projetos: 3 dias antes e no dia da entrega.
// Cada aviso sai uma vez só (marcado nas notificações da conta).
import { and, eq, gt, gte, inArray, isNotNull, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, projects, transactions, users } from "@/db/schema";
import { notify } from "./activity";
import { APP_PATH } from "./config";
import { addDays, addMonths, currentMonth, formatDate, todayISO } from "./dates";
import { emailEnabled, emailLayout, escapeHtml, sendEmail } from "./email";
import { DEFAULT_DAS_CENTS } from "./mei";
import { formatMoney } from "./money";
import { siteOrigin } from "./origin";

export const DAS_DAY = 20;
export const DAS_REMINDER_DAY = 15;
const DAS_CATEGORY = "Impostos (DAS, INSS)";
export const PGMEI_URL = "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao";

async function sentSet(types: string[]): Promise<Set<string>> {
  if (types.length === 0) return new Set();
  const rows = await getDb()
    .select({ userId: notifications.userId, type: notifications.type })
    .from(notifications)
    .where(inArray(notifications.type, types));
  return new Set(rows.map((r) => `${r.userId}|${r.type}`));
}

/** Lembrete do DAS. Conta como MEI quem informou o valor do DAS ou lançou DAS nos últimos 3 meses. */
export async function sendDasReminders(today = todayISO()): Promise<number> {
  if (Number(today.slice(8, 10)) !== DAS_REMINDER_DAY) return 0;
  const db = getDb();
  const month = currentMonth();
  const since = `${addMonths(month, -3)}-01`;
  const recent = await db
    .selectDistinct({ userId: transactions.userId })
    .from(transactions)
    .where(and(eq(transactions.category, DAS_CATEGORY), gte(transactions.date, since)));
  const recentIds = recent.map((r) => r.userId);
  const people = await db
    .select({ id: users.id, name: users.name, email: users.email, dasCents: users.dasCents })
    .from(users)
    .where(and(eq(users.isDemo, false), recentIds.length ? or(gt(users.dasCents, 0), inArray(users.id, recentIds)) : gt(users.dasCents, 0)))
    .limit(2000);
  if (people.length === 0) return 0;
  // Já lançou o DAS deste mês? Então não precisa lembrar.
  const paidThisMonth = new Set(
    (
      await db
        .selectDistinct({ userId: transactions.userId })
        .from(transactions)
        .where(and(eq(transactions.category, DAS_CATEGORY), like(transactions.date, `${month}-%`)))
    ).map((r) => r.userId),
  );
  const type = `das:${month}`;
  const sent = await sentSet([type]);
  const origin = await siteOrigin();
  const due = `${month}-${DAS_DAY}`;
  let count = 0;
  for (const person of people) {
    if (paidThisMonth.has(person.id) || sent.has(`${person.id}|${type}`)) continue;
    const value = formatMoney(person.dasCents || DEFAULT_DAS_CENTS);
    await notify(person.id, {
      type,
      title: `O DAS do MEI vence dia ${DAS_DAY}`,
      body: `Cerca de ${value}. Pague pelo PGMEI e lance como despesa em “${DAS_CATEGORY}”.`,
      href: `${APP_PATH}/lancamentos?novo=despesa`,
    });
    if (emailEnabled()) {
      await sendEmail({
        to: person.email,
        subject: `Lembrete: o DAS do MEI vence dia ${DAS_DAY}`,
        html: emailLayout({
          preheader: `Vence em ${formatDate(due)}.`,
          title: "Hora de pagar o DAS",
          paragraphs: [
            `Oi, ${escapeHtml(person.name.split(" ")[0])}! O DAS do MEI deste mês vence em <strong>${formatDate(due)}</strong>. Pagar em dia evita multa e mantém seus benefícios do INSS.`,
            `Gere a guia no PGMEI (site da Receita) e, depois de pagar, lance no Recebi como despesa em “${DAS_CATEGORY}” para os relatórios ficarem certos.`,
          ],
          highlight: { label: "Valor aproximado", value },
          cta: { label: "Gerar a guia no PGMEI", url: PGMEI_URL },
          footer: `Não é MEI? Zere o valor do DAS em <a href="${origin}${APP_PATH}/configuracoes" style="color:#7a8497">Configurações</a>.`,
        }),
      }).catch((error) => console.error("lembrete-das", error));
    }
    count++;
  }
  return count;
}

/** Avisos de prazo de entrega dos projetos ativos: 3 dias antes e no dia. */
export async function sendProjectDeadlines(today = todayISO()): Promise<number> {
  const soon = addDays(today, 3);
  const rows = await getDb()
    .select({ id: projects.id, userId: projects.userId, name: projects.name, dueDate: projects.dueDate })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.userId))
    .where(
      and(
        eq(projects.status, "ativo"),
        isNotNull(projects.dueDate),
        or(eq(projects.dueDate, today), eq(projects.dueDate, soon)),
        eq(users.isDemo, false),
      ),
    )
    .limit(2000);
  const typeOf = (r: (typeof rows)[number]) => `prazo:${r.id}:${r.dueDate === today ? "hoje" : "3d"}:${r.dueDate}`;
  const sent = await sentSet(rows.map(typeOf));
  let count = 0;
  for (const r of rows) {
    const type = typeOf(r);
    if (sent.has(`${r.userId}|${type}`)) continue;
    await notify(r.userId, {
      type,
      title: r.dueDate === today ? `Hoje é a entrega de “${r.name}”` : `“${r.name}” vence em 3 dias`,
      body: `Prazo: ${formatDate(r.dueDate)}.`,
      href: `${APP_PATH}/projetos`,
    });
    count++;
  }
  return count;
}
