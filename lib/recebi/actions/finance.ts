"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { clients, projects, transactions } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { hasPro, requireUser } from "../auth";
import { categoriesFor } from "../categories";
import { APP_PATH, FREE_LIMITS } from "../config";
import { countActiveClients } from "../data";
import { addMonthsToDate, isValidISODate } from "../dates";
import { ATTACHMENT_TYPES, removeFile, storeUpload } from "../files";
import { parseMoney } from "../money";

function refresh() {
  revalidatePath(APP_PATH, "layout");
}

/** Só aceita ids de clientes/projetos que pertencem ao usuário. */
async function ownedClientId(userId: string, id: string): Promise<string | null> {
  if (!id) return null;
  const [row] = await getDb()
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.id, id)))
    .limit(1);
  return row?.id ?? null;
}

async function ownedProject(userId: string, id: string) {
  if (!id) return null;
  const [row] = await getDb()
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.id, id)))
    .limit(1);
  return row ?? null;
}

// ---------- Lançamentos ----------

export async function saveTransaction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const type: "receita" | "despesa" = text(formData, "type") === "despesa" ? "despesa" : "receita";
  const description = text(formData, "description", 160);
  const amountCents = parseMoney(text(formData, "amount", 30));
  const category = text(formData, "category", 60);
  const date = text(formData, "date", 10);
  const status: "pago" | "pendente" = text(formData, "status") === "pendente" ? "pendente" : "pago";
  const repeat = Math.min(Math.max(Number(text(formData, "repeat", 3)) || 1, 1), 24);

  if (!description) return fail("Dê uma descrição para o lançamento.");
  if (amountCents === null || amountCents <= 0) return fail("Informe um valor maior que zero. Ex.: 1.250,00");
  if (amountCents > 100_000_000_00) return fail("Valor alto demais.");
  if (!isValidISODate(date)) return fail("Informe uma data válida.");
  if (!categoriesFor(type).includes(category)) return fail("Escolha uma categoria.");

  const project = await ownedProject(user.id, text(formData, "projectId", 64));
  const clientId = (await ownedClientId(user.id, text(formData, "clientId", 64))) ?? project?.clientId ?? null;
  const values = { type, description, amountCents, category, date, status, clientId, projectId: project?.id ?? null };

  // Comprovante (plano Pro, com armazenamento ativo).
  const file = formData.get("attachment");
  let attachment: { attachmentKey: string; attachmentName: string; attachmentType: string; attachmentSize: number } | null = null;
  if (file instanceof File && file.size > 0) {
    if (!hasPro(user) || user.isDemo) return fail("Anexar comprovantes é um recurso do plano Pro.");
    const stored = await storeUpload(`anexos/${user.id}`, file, ATTACHMENT_TYPES);
    if ("error" in stored) return fail(stored.error);
    attachment = {
      attachmentKey: stored.key,
      attachmentName: file.name.slice(0, 120),
      attachmentType: file.type,
      attachmentSize: file.size,
    };
  }

  const db = getDb();
  if (id) {
    const [existing] = await db
      .select({ attachmentKey: transactions.attachmentKey })
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .limit(1);
    if (!existing) {
      await removeFile(attachment?.attachmentKey);
      return fail("Lançamento não encontrado.");
    }
    const clearAttachment = text(formData, "removeAttachment") === "on";
    const attachmentValues =
      attachment ?? (clearAttachment ? { attachmentKey: null, attachmentName: null, attachmentType: null, attachmentSize: null } : {});
    await db
      .update(transactions)
      .set({ ...values, ...attachmentValues })
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
    if (attachment || clearAttachment) await removeFile(existing.attachmentKey);
    refresh();
    return success("Lançamento atualizado.");
  }

  const rows = Array.from({ length: repeat }, (_, i) => ({
    ...values,
    id: crypto.randomUUID(),
    userId: user.id,
    date: addMonthsToDate(date, i),
    // Só o primeiro mês herda o status escolhido (e o comprovante); os próximos ficam pendentes.
    status: i === 0 ? status : ("pendente" as const),
    ...(i === 0 && attachment ? attachment : {}),
    description: repeat > 1 ? `${description} (${i + 1}/${repeat})` : description,
  }));
  // D1 limita a quantidade de parâmetros por consulta, então inserimos em lotes.
  for (let i = 0; i < rows.length; i += 6) {
    await db.insert(transactions).values(rows.slice(i, i + 6));
  }
  refresh();
  const label = type === "receita" ? "Receita" : "Despesa";
  return success(repeat > 1 ? `${label} lançada em ${repeat} meses.` : `${label} lançada.`);
}

export async function deleteTransaction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const [deleted] = await getDb()
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .returning({ attachmentKey: transactions.attachmentKey });
  await removeFile(deleted?.attachmentKey);
  refresh();
  return success("Lançamento excluído.");
}

export async function toggleTransactionStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const db = getDb();
  const [row] = await db
    .select({ status: transactions.status })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .limit(1);
  if (!row) return fail("Lançamento não encontrado.");
  const status = row.status === "pago" ? "pendente" : "pago";
  await db
    .update(transactions)
    .set({ status })
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
  refresh();
  return success(status === "pago" ? "Marcado como pago." : "Marcado como pendente.");
}

// ---------- Clientes ----------

export async function saveClient(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const values = {
    name: text(formData, "name", 120),
    email: text(formData, "email", 200).toLowerCase(),
    phone: text(formData, "phone", 40),
    document: text(formData, "document", 30),
    notes: text(formData, "notes", 1000),
  };
  if (!values.name) return fail("Informe o nome do cliente.");
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return fail("E-mail inválido.");

  const db = getDb();
  if (id) {
    const result = await db
      .update(clients)
      .set(values)
      .where(and(eq(clients.id, id), eq(clients.userId, user.id)))
      .returning({ id: clients.id });
    if (result.length === 0) return fail("Cliente não encontrado.");
    refresh();
    return success("Cliente atualizado.");
  }

  if (!hasPro(user) && (await countActiveClients(user.id)) >= FREE_LIMITS.clients) {
    return fail(`O plano Grátis permite até ${FREE_LIMITS.clients} clientes ativos. Arquive um cliente ou conheça o Pro.`);
  }
  await db.insert(clients).values({ ...values, id: crypto.randomUUID(), userId: user.id });
  refresh();
  return success("Cliente cadastrado.");
}

export async function setClientArchived(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const archived = text(formData, "archived") === "1";
  if (!archived && !hasPro(user) && (await countActiveClients(user.id)) >= FREE_LIMITS.clients) {
    return fail(`O plano Grátis permite até ${FREE_LIMITS.clients} clientes ativos.`);
  }
  await getDb()
    .update(clients)
    .set({ archived })
    .where(and(eq(clients.id, id), eq(clients.userId, user.id)));
  refresh();
  return success(archived ? "Cliente arquivado." : "Cliente reativado.");
}

export async function deleteClient(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  await getDb()
    .delete(clients)
    .where(and(eq(clients.id, id), eq(clients.userId, user.id)));
  refresh();
  return success("Cliente excluído. Os lançamentos dele foram mantidos.");
}

// ---------- Projetos ----------

const PROJECT_STATUS = ["ativo", "pausado", "concluido"] as const;

export async function saveProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const name = text(formData, "name", 120);
  const budgetInput = text(formData, "budget", 30);
  const budgetCents = budgetInput ? parseMoney(budgetInput) : 0;
  const dueDate = text(formData, "dueDate", 10);
  const statusInput = text(formData, "status");
  const status = PROJECT_STATUS.find((s) => s === statusInput) ?? "ativo";

  if (!name) return fail("Informe o nome do projeto.");
  if (budgetCents === null || budgetCents < 0) return fail("Valor do projeto inválido.");
  if (dueDate && !isValidISODate(dueDate)) return fail("Prazo inválido.");

  const values = {
    name,
    status,
    budgetCents,
    dueDate: dueDate || null,
    clientId: await ownedClientId(user.id, text(formData, "clientId", 64)),
    notes: text(formData, "notes", 1000),
  };

  const db = getDb();
  if (id) {
    const result = await db
      .update(projects)
      .set(values)
      .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
      .returning({ id: projects.id });
    if (result.length === 0) return fail("Projeto não encontrado.");
    refresh();
    return success("Projeto atualizado.");
  }
  await db.insert(projects).values({ ...values, id: crypto.randomUUID(), userId: user.id });
  refresh();
  return success("Projeto criado.");
}

export async function setProjectStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const statusInput = text(formData, "status");
  const status = PROJECT_STATUS.find((s) => s === statusInput);
  if (!status) return fail("Status inválido.");
  await getDb()
    .update(projects)
    .set({ status })
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)));
  refresh();
  return success("Status do projeto atualizado.");
}

export async function deleteProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  await getDb()
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)));
  refresh();
  return success("Projeto excluído.");
}
