// Cobranças recorrentes: todo mês o Recebi gera (e pode enviar) a cobrança sozinho.
import { and, eq, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, recurringInvoices, users } from "@/db/schema";
import { logEvent, notify } from "./activity";
import { hasPro } from "./auth";
import { APP_PATH } from "./config";
import { addDays, monthLabel, nextMonthlyDate, todayISO } from "./dates";
import { createInvoice } from "./documents";
import { formatMoney } from "./money";
import { sendInvoiceEmail } from "./notifications";

/**
 * Gera as cobranças recorrentes que venceram até hoje. Se a pessoa ficou meses sem abrir o Recebi,
 * gera só a do período mais recente (não manda uma pilha de cobranças atrasadas ao cliente).
 */
export async function generateDueRecurring(options: { userId?: string; limit?: number } = {}): Promise<number> {
  const db = getDb();
  const today = todayISO();
  const conditions = [eq(recurringInvoices.active, true), lte(recurringInvoices.nextDate, today)];
  if (options.userId) conditions.push(eq(recurringInvoices.userId, options.userId));
  const due = await db
    .select({ rec: recurringInvoices, owner: users, clientName: clients.name })
    .from(recurringInvoices)
    .innerJoin(users, eq(users.id, recurringInvoices.userId))
    .leftJoin(clients, eq(clients.id, recurringInvoices.clientId))
    .where(and(...conditions))
    .limit(options.limit ?? 200);

  let created = 0;
  for (const { rec, owner, clientName } of due) {
    if (!hasPro(owner)) continue;
    let issueDate = rec.nextDate;
    let next = nextMonthlyDate(issueDate, rec.dayOfMonth);
    while (next <= today) {
      issueDate = next;
      next = nextMonthlyDate(next, rec.dayOfMonth);
    }
    // Reserva o período antes de gerar: duas execuções ao mesmo tempo não duplicam a cobrança.
    const claimed = await db
      .update(recurringInvoices)
      .set({ nextDate: next })
      .where(and(eq(recurringInvoices.id, rec.id), eq(recurringInvoices.nextDate, rec.nextDate)))
      .returning({ id: recurringInvoices.id });
    if (claimed.length === 0) continue;

    const invoice = await createInvoice({
      userId: rec.userId,
      clientId: rec.clientId,
      projectId: rec.projectId,
      status: rec.autoSend ? "enviada" : "rascunho",
      issueDate,
      dueDate: addDays(issueDate, rec.dueDays),
      discountCents: 0,
      notes: `Referente a ${monthLabel(issueDate.slice(0, 7))}.`,
      items: [{ description: rec.description, quantity: 1, unitPriceCents: rec.amountCents }],
    });
    await db.update(recurringInvoices).set({ lastInvoiceId: invoice.id }).where(eq(recurringInvoices.id, rec.id));
    await logEvent(rec.userId, "cobranca", invoice.id, "recorrente", `Todo dia ${rec.dayOfMonth}`);

    const emailed = rec.autoSend ? await sendInvoiceEmail(rec.userId, invoice.id) : false;
    if (emailed) await logEvent(rec.userId, "cobranca", invoice.id, "email", "Enviada automaticamente");
    const number = String(invoice.number).padStart(4, "0");
    await notify(rec.userId, {
      type: "recorrente",
      title: `Cobrança recorrente #${number} gerada`,
      body: `${clientName ?? "Cliente"} · ${formatMoney(rec.amountCents)} · ${
        emailed ? "enviada por e-mail ao cliente" : rec.autoSend ? "link pronto para enviar" : "rascunho para você revisar"
      }`,
      href: `${APP_PATH}/cobrancas/${invoice.id}`,
    });
    created++;
  }
  return created;
}
