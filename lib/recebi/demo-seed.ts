// Dados fictícios para a conta de demonstração, sempre relativos à data de hoje.
import { getDb } from "@/db";
import { clients, invoiceItems, invoices, projects, quoteItems, quotes, transactions, users } from "@/db/schema";
import { randomToken } from "./crypto";
import { addDays, addMonths, currentMonth, todayISO } from "./dates";

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
    document: "12.345.678/0001-95",
    phone: "(11) 97777-6666",
    city: "São Paulo",
    pixKey: "marina@costadesign.exemplo",
    monthlyGoalCents: 900_000,
    taxRateBp: 600,
    annualLimitCents: 8_100_000,
    plan: "pro",
    planExpiresAt: addDays(today, 1),
    isDemo: true,
    autoReminders: false,
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
  invoice(3, "enviada", addDays(today, -14), addDays(today, -4), [["Desenvolvimento do site — 2ª parcela", 1, 325_000]]);
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
  };
  quote(
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
    },
  );
  quote(2, "enviado", addDays(today, -3), [
    ["Redesign do cardápio", 1, 95_000],
    ["Fotos dos pratos", 20, 4_000],
  ]);
  quote(4, "recusado", addDays(today, -18), [["Loja virtual completa", 1, 1_200_000]], {
    decidedAt: `${addDays(today, -10)}T10:00:00.000Z`,
    decisionNote: "Gostamos muito, mas vamos deixar para o ano que vem.",
  });
  quote(5, "rascunho", today, [["Identidade para academia", 1, 350_000]]);

  // Um lote por tabela, respeitando o limite de parâmetros do D1.
  await db.batch([
    db.insert(clients).values(clientRows),
    db.insert(projects).values(projectRows),
    ...chunk(tx, 8).map((rows) => db.insert(transactions).values(rows)),
    ...chunk(invoiceRows, 6).map((rows) => db.insert(invoices).values(rows)),
    ...chunk(invoiceItemRows, 12).map((rows) => db.insert(invoiceItems).values(rows)),
    ...chunk(quoteRows, 5).map((rows) => db.insert(quotes).values(rows)),
    ...chunk(quoteItemRows, 12).map((rows) => db.insert(quoteItems).values(rows)),
  ] as unknown as Parameters<typeof db.batch>[0]);

  return userId;
}
