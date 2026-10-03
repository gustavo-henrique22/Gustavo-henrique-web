// Dados fictícios para a conta de demonstração, sempre relativos à data de hoje.
import { getDb } from "@/db";
import {
  categoryRules,
  clients,
  documentEvents,
  invoiceItems,
  invoices,
  notifications,
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
import { randomToken } from "./crypto";
import { APP_PATH } from "./config";
import { addDays, addMonths, currentMonth, firstMonthlyDate, todayISO } from "./dates";
import { sqliteTimestamp } from "./rate-limit";
import { sealClient, sealRequest, sealUser } from "./sensitive";

type Row<T extends { $inferInsert: unknown }> = T["$inferInsert"];

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export async function createDemoAccount(): Promise<string> {
  const db = getDb();
  const today = todayISO();
  const month = currentMonth();
  const day = Number(today.slice(8, 10));
  const userId = crypto.randomUUID();
  const date = (monthOffset: number, d: number) => `${addMonths(month, monthOffset)}-${String(d).padStart(2, "0")}`;
  // Datas do mês atual não passam de hoje, para os lançamentos pagos fazerem sentido.
  const pastDay = (d: number) => Math.min(d, day);

  await db.insert(users).values({
    id: userId,
    name: "Marina Costa",
    email: `demo-${crypto.randomUUID().slice(0, 12)}@demo.recebi.app`,
    passwordHash: "demo",
    businessName: "Marina Costa Design",
    // Mesmo na demonstração, os campos sensíveis seguem o caminho criptografado.
    ...(await sealUser(userId, { document: "12.345.678/0001-95", phone: "(11) 97777-6666", pixKey: "marina@costadesign.exemplo" })),
    city: "São Paulo",
    monthlyGoalCents: 900_000,
    taxRateBp: 600,
    annualLimitCents: 8_100_000,
    plan: "pro",
    planExpiresAt: addDays(today, 1),
    isDemo: true,
    autoReminders: false,
    hourlyRateCents: 12_000,
    slug: `demo-${crypto.randomUUID().slice(0, 8)}`,
    publicProfile: true,
    headline: "Designer de marcas e social media para pequenos negócios",
    bio: "Há 8 anos ajudo cafés, padarias, clínicas e lojas a terem uma marca forte e bonita nas redes.\nTrabalho com identidade visual, social media mensal e sites simples.",
    monthlySummary: false,
  });

  const clientNames = ["Studio Lima", "Padaria Sol", "Café Aroma", "Clínica Bem Estar", "Loja Verde", "Academia Movimento"];
  const clientRows: Row<typeof clients>[] = clientNames.map((name, i) => ({
    id: crypto.randomUUID(),
    userId,
    name,
    email: `contato@${name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z]/g, "")}.exemplo`,
    phone: `(11) 9${8000 + i * 137}-${1000 + i * 911}`,
  }));
  const c = clientRows.map((row) => row.id!);

  const projectRows: Row<typeof projects>[] = [
    { name: "Identidade visual", client: 1, budget: 480_000, status: "ativo" as const, due: addDays(today, 18) },
    { name: "Site institucional", client: 3, budget: 650_000, status: "ativo" as const, due: addDays(today, 9) },
    { name: "Social media mensal", client: 0, budget: 180_000, status: "ativo" as const, due: null },
    { name: "Cardápio digital", client: 2, budget: 150_000, status: "concluido" as const, due: addDays(today, -40) },
  ].map((p) => ({
    id: crypto.randomUUID(),
    userId,
    clientId: c[p.client],
    name: p.name,
    status: p.status,
    budgetCents: p.budget,
    dueDate: p.due,
  }));
  const p = projectRows.map((row) => row.id!);

  const tx: Row<typeof transactions>[] = [];
  const add = (row: Omit<Row<typeof transactions>, "id" | "userId">) => tx.push({ id: crypto.randomUUID(), userId, ...row });
  const variable = [520_000, 610_000, 480_000, 700_000, 660_000, 820_000];
  for (let i = -5; i <= 0; i++) {
    const current = i === 0;
    const d = (n: number) => (current ? date(0, pastDay(n)) : date(i, n));
    add({
      type: "receita",
      description: "Social media mensal",
      amountCents: 180_000,
      category: "Serviço mensal",
      date: d(5),
      status: "pago",
      clientId: c[0],
      projectId: p[2],
    });
    add({
      type: "receita",
      description: "Projeto de design",
      amountCents: variable[i + 5] - 300_000,
      category: "Projeto",
      date: d(15),
      status: current && day < 15 ? "pendente" : "pago",
      clientId: c[(i + 6) % 6],
      projectId: p[(i + 6) % 2],
    });
    add({
      type: "receita",
      description: "Consultoria de marca",
      amountCents: 120_000,
      category: "Consultoria",
      date: d(22),
      status: current && day < 22 ? "pendente" : "pago",
      clientId: c[(i + 8) % 6],
    });
    add({
      type: "despesa",
      description: "Adobe Creative Cloud",
      amountCents: 12_400,
      category: "Software e assinaturas",
      date: d(3),
      status: "pago",
    });
    add({
      type: "despesa",
      description: "Figma Professional",
      amountCents: 7_500,
      category: "Software e assinaturas",
      date: d(3),
      status: "pago",
    });
    add({ type: "despesa", description: "Coworking", amountCents: 45_000, category: "Coworking e escritório", date: d(8), status: "pago" });
    add({
      type: "despesa",
      description: "Internet fibra",
      amountCents: 11_990,
      category: "Internet e telefone",
      date: d(10),
      status: "pago",
    });
    add({
      type: "despesa",
      description: "DAS MEI",
      amountCents: 7_600,
      category: "Impostos (DAS, INSS)",
      date: d(20),
      status: current && day < 20 ? "pendente" : "pago",
    });
    if (i % 2 === 0)
      add({
        type: "despesa",
        description: "Anúncios no Instagram",
        amountCents: 30_000,
        category: "Marketing e anúncios",
        date: d(18),
        status: "pago",
      });
  }
  add({
    type: "despesa",
    description: "Monitor 27 polegadas",
    amountCents: 189_900,
    category: "Equipamentos",
    date: date(-3, 12),
    status: "pago",
  });
  add({
    type: "despesa",
    description: "Curso de UX Writing",
    amountCents: 49_700,
    category: "Cursos e livros",
    date: date(-2, 25),
    status: "pago",
  });
  add({
    type: "receita",
    description: "Parcela final do site",
    amountCents: 325_000,
    category: "Projeto",
    date: addDays(today, 6),
    status: "pendente",
    clientId: c[3],
    projectId: p[1],
  });
  add({
    type: "despesa",
    description: "Adobe Creative Cloud",
    amountCents: 12_400,
    category: "Software e assinaturas",
    date: addDays(today, 4),
    status: "pendente",
  });

  const invoiceRows: Row<typeof invoices>[] = [];
  const invoiceItemRows: Row<typeof invoiceItems>[] = [];
  const invoice = (
    client: number,
    status: "enviada" | "paga" | "rascunho",
    issue: string,
    due: string,
    items: [string, number, number][],
    paidAt: string | null = null,
  ) => {
    const id = crypto.randomUUID();
    invoiceRows.push({
      id,
      userId,
      clientId: c[client],
      number: invoiceRows.length + 1,
      publicToken: randomToken(18),
      status,
      issueDate: issue,
      dueDate: due,
      totalCents: items.reduce((sum, [, q, v]) => sum + q * v, 0),
      paidAt,
      notes: "Pagamento via Pix. Obrigada pela parceria!",
    });
    items.forEach(([description, quantity, unitPriceCents], position) =>
      invoiceItemRows.push({ id: crypto.randomUUID(), invoiceId: id, description, quantity, unitPriceCents, position }),
    );
    return id;
  };
  invoice(
    1,
    "paga",
    addDays(today, -40),
    addDays(today, -30),
    [
      ["Criação de logotipo", 1, 120_000],
      ["Manual de marca", 1, 60_000],
    ],
    addDays(today, -32),
  );
  invoice(4, "paga", addDays(today, -20), addDays(today, -12), [["Posts para Instagram", 8, 7_500]], addDays(today, -13));
  const overdueInvoice = invoice(3, "enviada", addDays(today, -14), addDays(today, -4), [
    ["Desenvolvimento do site — 2ª parcela", 1, 325_000],
  ]);
  const approvedInvoice = invoice(0, "enviada", addDays(today, -2), addDays(today, 5), [
    ["Social media — próximo mês", 1, 180_000],
    ["Fotos de produto", 12, 5_000],
  ]);
  invoice(5, "rascunho", today, addDays(today, 7), [["Campanha de lançamento", 1, 90_000]]);

  const quoteRows: Row<typeof quotes>[] = [];
  const quoteItemRows: Row<typeof quoteItems>[] = [];
  const quote = (
    client: number,
    status: "rascunho" | "enviado" | "aprovado" | "recusado",
    issue: string,
    items: [string, number, number][],
    extra: Partial<Row<typeof quotes>> = {},
  ) => {
    const id = crypto.randomUUID();
    quoteRows.push({
      id,
      userId,
      clientId: c[client],
      number: quoteRows.length + 1,
      publicToken: randomToken(18),
      status,
      issueDate: issue,
      validUntil: addDays(issue, 15),
      totalCents: items.reduce((sum, [, q, v]) => sum + q * v, 0),
      notes: "Prazo de entrega: 15 dias úteis após a aprovação. Inclui 2 rodadas de ajustes.",
      ...extra,
    });
    items.forEach(([description, quantity, unitPriceCents], position) =>
      quoteItemRows.push({ id: crypto.randomUUID(), quoteId: id, description, quantity, unitPriceCents, position }),
    );
    return id;
  };
  const approvedQuote = quote(
    0,
    "aprovado",
    addDays(today, -6),
    [
      ["Social media — próximo mês", 1, 180_000],
      ["Fotos de produto", 12, 5_000],
    ],
    {
      decidedAt: `${addDays(today, -2)}T14:20:00.000Z`,
      invoiceId: approvedInvoice,
      acceptedName: "Luiza Lima",
      acceptedIp: "200.150.10.20",
      viewedAt: `${addDays(today, -5)}T13:02:00.000Z`,
      viewCount: 3,
    },
  );
  const sentQuote = quote(
    2,
    "enviado",
    addDays(today, -3),
    [
      ["Redesign do cardápio", 1, 95_000],
      ["Fotos dos pratos", 20, 4_000],
    ],
    { viewedAt: `${addDays(today, -1)}T18:40:00.000Z`, viewCount: 2 },
  );
  quote(4, "recusado", addDays(today, -18), [["Loja virtual completa", 1, 1_200_000]], {
    decidedAt: `${addDays(today, -10)}T10:00:00.000Z`,
    decisionNote: "Gostamos muito, mas vamos deixar para o ano que vem.",
  });
  quote(5, "rascunho", today, [["Identidade para academia", 1, 350_000]]);

  // Histórico dos documentos, avisos, horas, serviços, recorrência e regras.
  const at = (date: string, time: string) => `${date} ${time}:00`;
  const eventRows: Row<typeof documentEvents>[] = [];
  const event = (documentType: "orcamento" | "cobranca", documentId: string, type: string, when: string, detail = "") =>
    eventRows.push({ id: crypto.randomUUID(), userId, documentType, documentId, type, detail, createdAt: when });
  event("orcamento", approvedQuote, "criado", at(addDays(today, -6), "12:10"));
  event("orcamento", approvedQuote, "enviado", at(addDays(today, -6), "12:12"));
  event("orcamento", approvedQuote, "visualizado", at(addDays(today, -5), "13:02"));
  event("orcamento", approvedQuote, "aprovado", at(addDays(today, -2), "14:20"), "Aceite eletrônico de Luiza Lima");
  event("orcamento", approvedQuote, "convertido", at(addDays(today, -2), "14:20"), "Cobrança #0004");
  event("cobranca", approvedInvoice, "criado", at(addDays(today, -2), "14:20"), "A partir do orçamento #0001");
  event("orcamento", sentQuote, "criado", at(addDays(today, -3), "09:30"));
  event("orcamento", sentQuote, "enviado", at(addDays(today, -3), "09:31"));
  event("orcamento", sentQuote, "visualizado", at(addDays(today, -1), "18:40"));
  event("cobranca", overdueInvoice, "criado", at(addDays(today, -14), "10:00"));
  event("cobranca", overdueInvoice, "enviado", at(addDays(today, -14), "10:01"));
  event("cobranca", overdueInvoice, "visualizado", at(addDays(today, -13), "08:15"));
  event("cobranca", overdueInvoice, "lembrete", at(addDays(today, -1), "09:00"), "3 dias após o vencimento");

  const noticeRows: Row<typeof notifications>[] = [
    {
      id: crypto.randomUUID(),
      userId,
      type: "pedido",
      title: "Novo pedido de orçamento: Rafael Mendes",
      body: "Identidade visual · Vou abrir uma hamburgueria em novembro e preciso de marca e cardápio.",
      href: `${APP_PATH}/pagina#pedidos`,
      createdAt: sqliteTimestamp(Date.now() - 2 * 3_600_000),
    },
    {
      id: crypto.randomUUID(),
      userId,
      type: "visualizado",
      title: "Café Aroma abriu o orçamento #0002",
      body: "Bom momento para mandar uma mensagem e tirar dúvidas.",
      href: `${APP_PATH}/orcamentos/${sentQuote}`,
      createdAt: at(addDays(today, -1), "18:40"),
    },
    {
      id: crypto.randomUUID(),
      userId,
      type: "aprovado",
      title: "Studio Lima aprovou o orçamento #0001 🎉",
      body: "A cobrança #0004 foi criada automaticamente.",
      href: `${APP_PATH}/cobrancas/${approvedInvoice}`,
      readAt: at(addDays(today, -2), "15:00"),
      createdAt: at(addDays(today, -2), "14:20"),
    },
  ];

  const hour = (days: number, hours: number, project: number, description: string) => {
    const start = new Date(`${addDays(today, -days)}T09:00:00-03:00`);
    return {
      id: crypto.randomUUID(),
      userId,
      projectId: p[project],
      description,
      startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + hours * 3_600_000).toISOString(),
      durationSeconds: Math.round(hours * 3600),
    };
  };
  const timeRows: Row<typeof timeEntries>[] = [
    hour(4, 2.5, 0, "Pesquisa de referências"),
    hour(3, 3, 0, "Esboços do logotipo"),
    hour(2, 1.5, 0, "Reunião de apresentação"),
    hour(1, 4, 1, "Layout da página inicial"),
  ];

  const serviceRows: Row<typeof services>[] = [
    ["Identidade visual", "Logotipo, paleta de cores, tipografia e manual de marca.", 150_000, "a-partir"],
    ["Social media mensal", "12 posts por mês com legenda, agendados no seu Instagram.", 180_000, "fixo"],
    ["Site institucional", "Site de até 5 páginas, rápido e fácil de atualizar.", 350_000, "a-partir"],
    ["Consultoria de marca", "Uma conversa de 1 hora para destravar a comunicação do seu negócio.", 0, "consulta"],
  ].map(([name, description, priceCents, priceType], position) => ({
    id: crypto.randomUUID(),
    userId,
    name: name as string,
    description: description as string,
    priceCents: priceCents as number,
    priceType: priceType as "fixo" | "a-partir" | "hora" | "consulta",
    position,
  }));

  // Esta demonstração é pública por um dia; nada aqui é dado real.
  const requestRow: Row<typeof quoteRequests> = {
    id: crypto.randomUUID(),
    userId,
    serviceId: serviceRows[0].id,
    name: "Rafael Mendes",
    email: "rafael@hamburgueria.exemplo",
    phone: "(11) 97654-3210",
    message: "Vou abrir uma hamburgueria em novembro e preciso de marca e cardápio. Tenho algumas referências de estilo.",
    createdAt: sqliteTimestamp(Date.now() - 2 * 3_600_000),
  };

  const recurringRow: Row<typeof recurringInvoices> = {
    id: crypto.randomUUID(),
    userId,
    clientId: c[0],
    projectId: p[2],
    description: "Social media mensal",
    amountCents: 180_000,
    dayOfMonth: 5,
    dueDays: 5,
    nextDate: firstMonthlyDate(addDays(today, 1), 5),
    autoSend: true,
  };

  const ruleRows: Row<typeof categoryRules>[] = [
    { id: crypto.randomUUID(), userId, pattern: "adobe", type: "despesa", category: "Software e assinaturas" },
    { id: crypto.randomUUID(), userId, pattern: "uber", type: "despesa", category: "Transporte" },
  ];

  const sealedClients = await Promise.all(clientRows.map(async (row) => ({ ...row, ...(await sealClient(row.id!, row)) })));

  // Um lote por tabela, respeitando o limite de parâmetros do D1.
  await db.batch([
    db.insert(clients).values(sealedClients),
    db.insert(projects).values(projectRows),
    ...chunk(tx, 8).map((rows) => db.insert(transactions).values(rows)),
    ...chunk(invoiceRows, 6).map((rows) => db.insert(invoices).values(rows)),
    ...chunk(invoiceItemRows, 12).map((rows) => db.insert(invoiceItems).values(rows)),
    ...chunk(quoteRows, 5).map((rows) => db.insert(quotes).values(rows)),
    ...chunk(quoteItemRows, 12).map((rows) => db.insert(quoteItems).values(rows)),
    ...chunk(eventRows, 12).map((rows) => db.insert(documentEvents).values(rows)),
    db.insert(notifications).values(noticeRows),
    db.insert(timeEntries).values(timeRows),
    db.insert(services).values(serviceRows),
    db.insert(quoteRequests).values({ ...requestRow, ...(await sealRequest(requestRow.id!, requestRow)) }),
    db.insert(recurringInvoices).values(recurringRow),
    db.insert(categoryRules).values(ruleRows),
  ] as unknown as Parameters<typeof db.batch>[0]);

  return userId;
}
