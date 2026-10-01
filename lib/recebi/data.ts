// Consultas de leitura usadas pelas páginas do painel. Toda consulta filtra
// pelo usuário logado; nunca chame estas funções com um id vindo do formulário.
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, like, lt, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  categoryRules,
  clients,
  invoiceItems,
  invoices,
  projects,
  quoteItems,
  quoteRequests,
  quotes,
  recurringInvoices,
  services,
  timeEntries,
  transactions,
  users,
} from "@/db/schema";
import { addMonths, monthBounds, todayISO } from "./dates";

const sumAmount = sql<number>`coalesce(sum(${transactions.amountCents}), 0)`;

export async function getUserById(id: string) {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function listClients(userId: string, { includeArchived = false } = {}) {
  return getDb()
    .select()
    .from(clients)
    .where(includeArchived ? eq(clients.userId, userId) : and(eq(clients.userId, userId), eq(clients.archived, false)))
    .orderBy(asc(sql`lower(${clients.name})`));
}

export async function listProjects(userId: string) {
  return getDb()
    .select({ project: projects, clientName: clients.name })
    .from(projects)
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(projects.userId, userId))
    .orderBy(asc(sql`case ${projects.status} when 'ativo' then 0 when 'pausado' then 1 else 2 end`), desc(projects.createdAt));
}

export async function getClient(userId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.id, id)))
    .limit(1);
  return row ?? null;
}

export async function countActiveClients(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.archived, false)));
  return row.count;
}

export async function countInvoicesInMonth(userId: string, month: string): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(and(eq(invoices.userId, userId), like(invoices.createdAt, `${month}%`)));
  return row.count;
}

export type TransactionFilters = {
  month: string;
  type?: "receita" | "despesa";
  status?: "pago" | "pendente";
  search?: string;
  clientId?: string;
};

export async function listTransactions(userId: string, filters: TransactionFilters) {
  const { start, end } = monthBounds(filters.month);
  const conditions = [eq(transactions.userId, userId), gte(transactions.date, start), lte(transactions.date, end)];
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.status) conditions.push(eq(transactions.status, filters.status));
  if (filters.clientId) conditions.push(eq(transactions.clientId, filters.clientId));
  if (filters.search) {
    const term = `%${filters.search.replace(/[%_]/g, "")}%`;
    conditions.push(or(like(transactions.description, term), like(transactions.category, term))!);
  }

  return getDb()
    .select({
      transaction: transactions,
      clientName: clients.name,
      projectName: projects.name,
      invoiceNumber: invoices.number,
    })
    .from(transactions)
    .leftJoin(clients, eq(clients.id, transactions.clientId))
    .leftJoin(projects, eq(projects.id, transactions.projectId))
    .leftJoin(invoices, eq(invoices.id, transactions.invoiceId))
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
}

/** Totais de um mês, pagos e pendentes, por tipo. */
export async function monthTotals(userId: string, month: string) {
  const { start, end } = monthBounds(month);
  const rows = await getDb()
    .select({ type: transactions.type, status: transactions.status, total: sumAmount })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.date, start), lte(transactions.date, end)))
    .groupBy(transactions.type, transactions.status);

  const get = (type: string, status: string) => rows.find((r) => r.type === type && r.status === status)?.total ?? 0;
  return {
    incomePaid: get("receita", "pago"),
    incomePending: get("receita", "pendente"),
    expensePaid: get("despesa", "pago"),
    expensePending: get("despesa", "pendente"),
  };
}

/** Receitas e despesas pagas por mês, dos últimos `count` meses até `lastMonth`. */
export async function monthlySeries(userId: string, lastMonth: string, count: number) {
  const firstMonth = addMonths(lastMonth, -(count - 1));
  const rows = await getDb()
    .select({ month: sql<string>`substr(${transactions.date}, 1, 7)`, type: transactions.type, total: sumAmount })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, "pago"),
        gte(transactions.date, `${firstMonth}-01`),
        lte(transactions.date, monthBounds(lastMonth).end),
      ),
    )
    .groupBy(sql`substr(${transactions.date}, 1, 7)`, transactions.type);

  return Array.from({ length: count }, (_, i) => {
    const month = addMonths(firstMonth, i);
    const income = rows.find((r) => r.month === month && r.type === "receita")?.total ?? 0;
    const expense = rows.find((r) => r.month === month && r.type === "despesa")?.total ?? 0;
    return { month, income, expense, profit: income - expense };
  });
}

/** Valores em aberto: receitas pendentes + cobranças enviadas ainda não pagas. */
export async function openReceivables(userId: string) {
  const today = todayISO();
  const db = getDb();
  const [pendingTx] = await db
    .select({
      total: sumAmount,
      overdue: sql<number>`coalesce(sum(case when ${transactions.date} < ${today} then ${transactions.amountCents} else 0 end), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, "receita"), eq(transactions.status, "pendente")));
  const [openInvoices] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.totalCents}), 0)`,
      overdue: sql<number>`coalesce(sum(case when ${invoices.dueDate} < ${today} then ${invoices.totalCents} else 0 end), 0)`,
    })
    .from(invoices)
    .where(and(eq(invoices.userId, userId), eq(invoices.status, "enviada")));

  return {
    total: pendingTx.total + openInvoices.total,
    overdue: pendingTx.overdue + openInvoices.overdue,
  };
}

export async function openPayables(userId: string) {
  const today = todayISO();
  const [row] = await getDb()
    .select({
      total: sumAmount,
      overdue: sql<number>`coalesce(sum(case when ${transactions.date} < ${today} then ${transactions.amountCents} else 0 end), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, "despesa"), eq(transactions.status, "pendente")));
  return row;
}

export type AgendaItem = {
  id: string;
  kind: "receita" | "despesa" | "cobranca";
  title: string;
  subtitle: string | null;
  date: string;
  amountCents: number;
  href: string;
};

/** Próximos vencimentos (e atrasados) de receitas, despesas e cobranças em aberto. */
export async function agenda(userId: string, limit = 8): Promise<AgendaItem[]> {
  const db = getDb();
  const [pending, openInvoices] = await Promise.all([
    db
      .select({ t: transactions, clientName: clients.name })
      .from(transactions)
      .leftJoin(clients, eq(clients.id, transactions.clientId))
      .where(and(eq(transactions.userId, userId), eq(transactions.status, "pendente")))
      .orderBy(asc(transactions.date))
      .limit(limit),
    db
      .select({ i: invoices, clientName: clients.name })
      .from(invoices)
      .leftJoin(clients, eq(clients.id, invoices.clientId))
      .where(and(eq(invoices.userId, userId), eq(invoices.status, "enviada")))
      .orderBy(asc(invoices.dueDate))
      .limit(limit),
  ]);

  const items: AgendaItem[] = [
    ...pending.map(({ t, clientName }) => ({
      id: t.id,
      kind: t.type,
      title: t.description,
      subtitle: clientName ?? t.category,
      date: t.date,
      amountCents: t.amountCents,
      href: `/recebi/painel/lancamentos?mes=${t.date.slice(0, 7)}&status=pendente`,
    })),
    ...openInvoices.map(({ i, clientName }) => ({
      id: i.id,
      kind: "cobranca" as const,
      title: `Cobrança #${String(i.number).padStart(4, "0")}`,
      subtitle: clientName,
      date: i.dueDate,
      amountCents: i.totalCents,
      href: `/recebi/painel/cobrancas/${i.id}`,
    })),
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

export async function incomeByClient(userId: string, start: string, end: string, limit = 5) {
  return getDb()
    .select({ clientId: transactions.clientId, name: clients.name, total: sumAmount })
    .from(transactions)
    .leftJoin(clients, eq(clients.id, transactions.clientId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "receita"),
        eq(transactions.status, "pago"),
        gte(transactions.date, start),
        lte(transactions.date, end),
      ),
    )
    .groupBy(transactions.clientId)
    .orderBy(desc(sumAmount))
    .limit(limit);
}

export async function totalsByCategory(userId: string, type: "receita" | "despesa", start: string, end: string) {
  return getDb()
    .select({ category: transactions.category, total: sumAmount, count: sql<number>`count(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, type),
        eq(transactions.status, "pago"),
        gte(transactions.date, start),
        lte(transactions.date, end),
      ),
    )
    .groupBy(transactions.category)
    .orderBy(desc(sumAmount));
}

export async function paidIncomeBetween(userId: string, start: string, end: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: sumAmount })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "receita"),
        eq(transactions.status, "pago"),
        gte(transactions.date, start),
        lte(transactions.date, end),
      ),
    );
  return row.total;
}

export async function hasAnyData(userId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: transactions.id }).from(transactions).where(eq(transactions.userId, userId)).limit(1);
  return !!row;
}

// ---------- Clientes ----------

export async function clientsWithStats(userId: string, includeArchived: boolean) {
  const db = getDb();
  const rows = await listClients(userId, { includeArchived });
  if (rows.length === 0) return [];
  const ids = rows.map((c) => c.id);

  const [paid, open] = await Promise.all([
    db
      .select({ clientId: transactions.clientId, total: sumAmount, last: sql<string>`max(${transactions.date})` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "receita"),
          eq(transactions.status, "pago"),
          inArray(transactions.clientId, ids),
        ),
      )
      .groupBy(transactions.clientId),
    db
      .select({ clientId: invoices.clientId, total: sql<number>`coalesce(sum(${invoices.totalCents}), 0)` })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), eq(invoices.status, "enviada"), inArray(invoices.clientId, ids)))
      .groupBy(invoices.clientId),
  ]);

  return rows.map((client) => ({
    client,
    paidCents: paid.find((p) => p.clientId === client.id)?.total ?? 0,
    lastPayment: paid.find((p) => p.clientId === client.id)?.last ?? null,
    openCents: open.find((o) => o.clientId === client.id)?.total ?? 0,
  }));
}

// ---------- Cobranças ----------

export async function listInvoices(userId: string, status?: string) {
  const today = todayISO();
  const conditions = [eq(invoices.userId, userId)];
  if (status === "vencida") {
    conditions.push(eq(invoices.status, "enviada"), lt(invoices.dueDate, today));
  } else if (status === "enviada") {
    conditions.push(eq(invoices.status, "enviada"), gte(invoices.dueDate, today));
  } else if (status === "rascunho" || status === "paga" || status === "cancelada") {
    conditions.push(eq(invoices.status, status));
  }
  return getDb()
    .select({ invoice: invoices, clientName: clients.name })
    .from(invoices)
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(...conditions))
    .orderBy(desc(invoices.number));
}

export async function invoiceStats(userId: string) {
  const today = todayISO();
  const [row] = await getDb()
    .select({
      open: sql<number>`coalesce(sum(case when ${invoices.status} = 'enviada' and ${invoices.dueDate} >= ${today} then ${invoices.totalCents} else 0 end), 0)`,
      overdue: sql<number>`coalesce(sum(case when ${invoices.status} = 'enviada' and ${invoices.dueDate} < ${today} then ${invoices.totalCents} else 0 end), 0)`,
      paid: sql<number>`coalesce(sum(case when ${invoices.status} = 'paga' and substr(${invoices.paidAt}, 1, 7) = ${today.slice(0, 7)} then ${invoices.totalCents} else 0 end), 0)`,
      drafts: sql<number>`coalesce(sum(case when ${invoices.status} = 'rascunho' then 1 else 0 end), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.userId, userId));
  return row;
}

export async function getInvoice(userId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.userId, userId), eq(invoices.id, id)))
    .limit(1);
  if (!row) return null;
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.position));
  return { ...row, items };
}

/** Cobrança pública (link enviado ao cliente). Não mostra rascunhos. */
export async function getPublicInvoice(token: string) {
  const db = getDb();
  const [row] = await db
    .select({ invoice: invoices, client: clients, owner: users })
    .from(invoices)
    .innerJoin(users, eq(users.id, invoices.userId))
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.publicToken, token), ne(invoices.status, "rascunho")))
    .limit(1);
  if (!row) return null;
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, row.invoice.id)).orderBy(asc(invoiceItems.position));
  return { ...row, items };
}

// ---------- Orçamentos ----------

export async function countQuotesInMonth(userId: string, month: string): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(quotes)
    .where(and(eq(quotes.userId, userId), like(quotes.createdAt, `${month}%`)));
  return row.count;
}

export async function listQuotes(userId: string, status?: string) {
  const today = todayISO();
  const conditions = [eq(quotes.userId, userId)];
  if (status === "expirado") {
    conditions.push(eq(quotes.status, "enviado"), lt(quotes.validUntil, today));
  } else if (status === "enviado") {
    conditions.push(eq(quotes.status, "enviado"), gte(quotes.validUntil, today));
  } else if (status === "rascunho" || status === "aprovado" || status === "recusado") {
    conditions.push(eq(quotes.status, status));
  }
  return getDb()
    .select({ quote: quotes, clientName: clients.name })
    .from(quotes)
    .leftJoin(clients, eq(clients.id, quotes.clientId))
    .where(and(...conditions))
    .orderBy(desc(quotes.number));
}

export async function quoteStats(userId: string) {
  const today = todayISO();
  const [row] = await getDb()
    .select({
      waiting: sql<number>`coalesce(sum(case when ${quotes.status} = 'enviado' and ${quotes.validUntil} >= ${today} then ${quotes.totalCents} else 0 end), 0)`,
      approvedMonth: sql<number>`coalesce(sum(case when ${quotes.status} = 'aprovado' and substr(${quotes.decidedAt}, 1, 7) = ${today.slice(0, 7)} then ${quotes.totalCents} else 0 end), 0)`,
      approved: sql<number>`coalesce(sum(case when ${quotes.status} = 'aprovado' then 1 else 0 end), 0)`,
      decided: sql<number>`coalesce(sum(case when ${quotes.status} in ('aprovado', 'recusado') then 1 else 0 end), 0)`,
    })
    .from(quotes)
    .where(eq(quotes.userId, userId));
  return { ...row, approvalRate: row.decided > 0 ? Math.round((row.approved / row.decided) * 100) : null };
}

export async function getQuote(userId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select({ quote: quotes, client: clients, invoiceToken: invoices.publicToken, invoiceNumber: invoices.number })
    .from(quotes)
    .leftJoin(clients, eq(clients.id, quotes.clientId))
    .leftJoin(invoices, eq(invoices.id, quotes.invoiceId))
    .where(and(eq(quotes.userId, userId), eq(quotes.id, id)))
    .limit(1);
  if (!row) return null;
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, id)).orderBy(asc(quoteItems.position));
  return { ...row, items };
}

/** Orçamento público (link enviado ao cliente). Não mostra rascunhos. */
export async function getPublicQuote(token: string) {
  const db = getDb();
  const [row] = await db
    .select({ quote: quotes, client: clients, owner: users, invoiceToken: invoices.publicToken })
    .from(quotes)
    .innerJoin(users, eq(users.id, quotes.userId))
    .leftJoin(clients, eq(clients.id, quotes.clientId))
    .leftJoin(invoices, eq(invoices.id, quotes.invoiceId))
    .where(and(eq(quotes.publicToken, token), ne(quotes.status, "rascunho")))
    .limit(1);
  if (!row) return null;
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, row.quote.id)).orderBy(asc(quoteItems.position));
  return { ...row, items };
}

// ---------- Controle de horas ----------

export async function runningTimer(userId: string) {
  const [row] = await getDb()
    .select({ entry: timeEntries, projectName: projects.name })
    .from(timeEntries)
    .leftJoin(projects, eq(projects.id, timeEntries.projectId))
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.endedAt)))
    .limit(1);
  return row ?? null;
}

export async function listTimeEntries(userId: string, sinceIso: string) {
  return getDb()
    .select({ entry: timeEntries, projectName: projects.name, invoiceNumber: invoices.number })
    .from(timeEntries)
    .leftJoin(projects, eq(projects.id, timeEntries.projectId))
    .leftJoin(invoices, eq(invoices.id, timeEntries.invoiceId))
    .where(and(eq(timeEntries.userId, userId), gte(timeEntries.startedAt, sinceIso), isNotNull(timeEntries.endedAt)))
    .orderBy(desc(timeEntries.startedAt))
    .limit(300);
}

/** Horas terminadas e ainda não cobradas, por projeto. */
export async function unbilledHours(userId: string) {
  return getDb()
    .select({
      projectId: timeEntries.projectId,
      projectName: projects.name,
      clientId: projects.clientId,
      clientName: clients.name,
      rate: projects.hourlyRateCents,
      seconds: sql<number>`coalesce(sum(${timeEntries.durationSeconds}), 0)`,
    })
    .from(timeEntries)
    .leftJoin(projects, eq(projects.id, timeEntries.projectId))
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.invoiceId), isNotNull(timeEntries.endedAt)))
    .groupBy(timeEntries.projectId);
}

export async function listCategoryRules(userId: string) {
  return getDb().select().from(categoryRules).where(eq(categoryRules.userId, userId)).orderBy(asc(categoryRules.pattern));
}

export async function listRecurring(userId: string) {
  return getDb()
    .select({ recurring: recurringInvoices, clientName: clients.name, clientEmail: clients.email, lastInvoiceNumber: invoices.number })
    .from(recurringInvoices)
    .leftJoin(clients, eq(clients.id, recurringInvoices.clientId))
    .leftJoin(invoices, eq(invoices.id, recurringInvoices.lastInvoiceId))
    .where(eq(recurringInvoices.userId, userId))
    .orderBy(desc(recurringInvoices.active), asc(recurringInvoices.nextDate));
}

export async function listServices(userId: string) {
  return getDb().select().from(services).where(eq(services.userId, userId)).orderBy(asc(services.position), asc(services.createdAt));
}

export async function listQuoteRequests(userId: string) {
  return getDb()
    .select({ request: quoteRequests, serviceName: services.name })
    .from(quoteRequests)
    .leftJoin(services, eq(services.id, quoteRequests.serviceId))
    .where(eq(quoteRequests.userId, userId))
    .orderBy(desc(quoteRequests.createdAt))
    .limit(100);
}

export async function getQuoteRequest(userId: string, id: string) {
  const [row] = await getDb()
    .select({ request: quoteRequests, service: services })
    .from(quoteRequests)
    .leftJoin(services, eq(services.id, quoteRequests.serviceId))
    .where(and(eq(quoteRequests.userId, userId), eq(quoteRequests.id, id)))
    .limit(1);
  return row ?? null;
}

/** Página pública: só aparece se a pessoa publicou. */
export async function getPublicProfile(slug: string) {
  const [owner] = await getDb()
    .select()
    .from(users)
    .where(and(eq(users.slug, slug), eq(users.publicProfile, true)))
    .limit(1);
  if (!owner) return null;
  return { owner, services: await listServices(owner.id) };
}

/** Quantos passos do guia de primeiros passos a pessoa já fez. */
export async function onboardingSnapshot(userId: string) {
  const db = getDb();
  const [[clientRow], [quoteRow], [invoiceRow], [incomeRow]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(clients)
      .where(eq(clients.userId, userId)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(quotes)
      .where(and(eq(quotes.userId, userId), ne(quotes.status, "rascunho"))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), ne(invoices.status, "rascunho"))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "receita"))),
  ]);
  return { clients: clientRow.n, sentDocuments: quoteRow.n + invoiceRow.n, incomes: incomeRow.n };
}
