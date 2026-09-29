"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { clients, projects, recurringInvoices } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { hasPro, requireUser } from "../auth";
import { APP_PATH } from "../config";
import { dateInMonth, firstMonthlyDate, todayISO } from "../dates";
import { parseMoney } from "../money";
import { generateDueRecurring } from "../recurring";

const MAX_RECURRING = 50;

function refresh() {
  revalidatePath(APP_PATH, "layout");
}

async function findRecurring(userId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(recurringInvoices)
    .where(and(eq(recurringInvoices.userId, userId), eq(recurringInvoices.id, id)))
    .limit(1);
  return row ?? null;
}

export async function saveRecurring(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!hasPro(user)) return fail("Cobranças recorrentes fazem parte do plano Pro.");
  const id = text(formData, "id", 64);
  const description = text(formData, "description", 200);
  const amountCents = parseMoney(text(formData, "amount", 30));
  const dayOfMonth = Math.trunc(Number(text(formData, "dayOfMonth", 2)));
  const dueDays = Math.trunc(Number(text(formData, "dueDays", 2)));
  const autoSend = text(formData, "autoSend") === "on";

  if (!description) return fail("Descreva o que é cobrado todo mês. Ex.: Gestão de redes sociais");
  if (amountCents === null || amountCents <= 0) return fail("Informe um valor maior que zero.");
  if (!(dayOfMonth >= 1 && dayOfMonth <= 31)) return fail("Escolha um dia do mês entre 1 e 31.");
  if (!(dueDays >= 0 && dueDays <= 60)) return fail("O prazo de pagamento deve ser de 0 a 60 dias.");

  const db = getDb();
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.userId, user.id), eq(clients.id, text(formData, "clientId", 64))))
    .limit(1);
  if (!client) return fail("Escolha o cliente.");
  const projectInput = text(formData, "projectId", 64);
  const [project] = projectInput
    ? await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.userId, user.id), eq(projects.id, projectInput)))
        .limit(1)
    : [];
  const today = todayISO();
  const values = { clientId: client.id, projectId: project?.id ?? null, description, amountCents, dayOfMonth, dueDays, autoSend };

  if (id) {
    const existing = await findRecurring(user.id, id);
    if (!existing) return fail("Cobrança recorrente não encontrada.");
    // Mudou o dia: vale a partir do mês que ainda não foi gerado.
    let nextDate = existing.nextDate;
    if (existing.dayOfMonth !== dayOfMonth) {
      const sameMonth = dateInMonth(existing.nextDate.slice(0, 7), dayOfMonth);
      nextDate = sameMonth >= today ? sameMonth : firstMonthlyDate(today, dayOfMonth);
    }
    await db
      .update(recurringInvoices)
      .set({ ...values, nextDate })
      .where(eq(recurringInvoices.id, id));
    refresh();
    return success("Cobrança recorrente atualizada.");
  }

  const [{ total }] = await db.select({ total: count() }).from(recurringInvoices).where(eq(recurringInvoices.userId, user.id));
  if (total >= MAX_RECURRING) return fail(`Você pode ter até ${MAX_RECURRING} cobranças recorrentes.`);
  const firstInput = text(formData, "firstDate", 10);
  const firstDate = /^\d{4}-\d{2}-\d{2}$/.test(firstInput) && firstInput >= today ? firstInput : firstMonthlyDate(today, dayOfMonth);
  await db.insert(recurringInvoices).values({ id: crypto.randomUUID(), userId: user.id, ...values, nextDate: firstDate, active: true });
  // Se a primeira é hoje, já gera na hora.
  const generated = firstDate === today ? await generateDueRecurring({ userId: user.id, limit: 5 }) : 0;
  refresh();
  return success(
    generated > 0
      ? "Pronto! A primeira cobrança já foi gerada."
      : `Pronto! A primeira cobrança sai em ${firstDate.split("-").reverse().join("/")}.`,
  );
}

export async function toggleRecurring(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const existing = await findRecurring(user.id, text(formData, "id", 64));
  if (!existing) return fail("Cobrança recorrente não encontrada.");
  const active = !existing.active;
  if (active && !hasPro(user)) return fail("Cobranças recorrentes fazem parte do plano Pro.");
  const today = todayISO();
  // Ao reativar, não gera meses que ficaram para trás.
  const nextDate = active && existing.nextDate < today ? firstMonthlyDate(today, existing.dayOfMonth) : existing.nextDate;
  await getDb().update(recurringInvoices).set({ active, nextDate }).where(eq(recurringInvoices.id, existing.id));
  refresh();
  return success(active ? "Cobrança recorrente reativada." : "Cobrança recorrente pausada.");
}

export async function deleteRecurring(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  await getDb()
    .delete(recurringInvoices)
    .where(and(eq(recurringInvoices.userId, user.id), eq(recurringInvoices.id, text(formData, "id", 64))));
  refresh();
  return success("Cobrança recorrente excluída. As cobranças já geradas continuam na lista.");
}
