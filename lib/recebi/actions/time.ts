"use server";

import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { clients, projects, timeEntries } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { logEvent } from "../activity";
import { hasPro, requireUser } from "../auth";
import { APP_PATH, FREE_LIMITS } from "../config";
import { countInvoicesInMonth } from "../data";
import { addDays, currentMonth, formatDate, isValidISODate, todayISO } from "../dates";
import { createInvoice } from "../documents";

function refresh() {
  revalidatePath(APP_PATH, "layout");
}

async function ownedProjectId(userId: string, id: string): Promise<string | null> {
  if (!id) return null;
  const [row] = await getDb()
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.id, id)))
    .limit(1);
  return row?.id ?? null;
}

/** Para o cronômetro que estiver rodando (se houver). */
async function stopRunning(userId: string): Promise<boolean> {
  const db = getDb();
  const [running] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.endedAt)))
    .limit(1);
  if (!running) return false;
  const now = new Date();
  const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(running.startedAt)) / 1000));
  await db
    .update(timeEntries)
    .set({ endedAt: now.toISOString(), durationSeconds: Math.min(seconds, 24 * 3600) })
    .where(eq(timeEntries.id, running.id));
  return true;
}

export async function startTimer(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  await stopRunning(user.id);
  await getDb()
    .insert(timeEntries)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      projectId: await ownedProjectId(user.id, text(formData, "projectId", 64)),
      description: text(formData, "description", 200),
      startedAt: new Date().toISOString(),
    });
  refresh();
  return success("Cronômetro iniciado. Bom trabalho!");
}

export async function stopTimer(): Promise<ActionState> {
  const user = await requireUser();
  const stopped = await stopRunning(user.id);
  refresh();
  return stopped ? success("Tempo registrado.") : fail("Nenhum cronômetro rodando.");
}

export async function addTimeEntry(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const date = text(formData, "date", 10);
  const hours = Number(text(formData, "hours", 3)) || 0;
  const minutes = Number(text(formData, "minutes", 3)) || 0;
  const seconds = Math.round(hours * 3600 + minutes * 60);
  if (!isValidISODate(date) || date > todayISO()) return fail("Escolha uma data de hoje ou antes.");
  if (seconds <= 0 || seconds > 24 * 3600) return fail("Informe entre 1 minuto e 24 horas.");

  // Guardamos o início às 9h (horário de Brasília) do dia escolhido.
  const start = new Date(`${date}T09:00:00-03:00`);
  await getDb()
    .insert(timeEntries)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      projectId: await ownedProjectId(user.id, text(formData, "projectId", 64)),
      description: text(formData, "description", 200),
      startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + seconds * 1000).toISOString(),
      durationSeconds: seconds,
    });
  refresh();
  return success("Horas lançadas.");
}

export async function deleteTimeEntry(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  await getDb()
    .delete(timeEntries)
    .where(and(eq(timeEntries.id, text(formData, "id", 64)), eq(timeEntries.userId, user.id), isNull(timeEntries.invoiceId)));
  refresh();
  return success("Registro excluído.");
}

/** Junta as horas ainda não cobradas de um projeto numa cobrança (rascunho) para revisar e enviar. */
export async function billProjectHours(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const db = getDb();
  const projectId = text(formData, "projectId", 64);
  const [project] = await db
    .select({ project: projects, clientName: clients.name })
    .from(projects)
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(projects.userId, user.id), eq(projects.id, projectId)))
    .limit(1);
  if (!project) return fail("Projeto não encontrado.");
  if (!project.project.clientId) return fail("Associe um cliente a este projeto antes de faturar as horas.");
  const rate = project.project.hourlyRateCents || user.hourlyRateCents;
  if (rate <= 0) return fail("Defina o valor da sua hora em Configurações (ou no projeto) antes de faturar.");
  if (!hasPro(user) && (await countInvoicesInMonth(user.id, currentMonth())) >= FREE_LIMITS.invoicesPerMonth) {
    return fail(`O plano Grátis permite ${FREE_LIMITS.invoicesPerMonth} cobranças por mês.`);
  }

  const entries = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, user.id),
        eq(timeEntries.projectId, projectId),
        isNull(timeEntries.invoiceId),
        isNotNull(timeEntries.endedAt),
      ),
    )
    .orderBy(asc(timeEntries.startedAt));
  const seconds = entries.reduce((sum, e) => sum + e.durationSeconds, 0);
  if (seconds < 60) return fail("Não há horas a faturar neste projeto.");

  const hours = Math.round((seconds / 3600) * 100) / 100;
  const first = formatDate(entries[0].startedAt.slice(0, 10));
  const last = formatDate(entries[entries.length - 1].startedAt.slice(0, 10));
  const today = todayISO();
  const invoice = await createInvoice({
    userId: user.id,
    clientId: project.project.clientId,
    projectId,
    status: "rascunho",
    issueDate: today,
    dueDate: addDays(today, 7),
    discountCents: 0,
    notes: `Horas trabalhadas de ${first} a ${last}.`,
    items: [{ description: `Horas trabalhadas — ${project.project.name}`, quantity: hours, unitPriceCents: rate }],
  });
  for (const entry of entries) {
    await db.update(timeEntries).set({ invoiceId: invoice.id }).where(eq(timeEntries.id, entry.id));
  }
  await logEvent(user.id, "cobranca", invoice.id, "criado", `A partir de ${hours.toLocaleString("pt-BR")} h registradas`);
  refresh();
  redirect(`${APP_PATH}/cobrancas/${invoice.id}/editar`);
}
