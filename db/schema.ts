// Tabelas do Recebi, o controle financeiro para freelancers.
// Valores em dinheiro são sempre guardados em centavos (inteiros) e datas de
// competência como texto `YYYY-MM-DD`, para evitar erros de arredondamento e
// de fuso horário.
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    businessName: text("business_name").notNull().default(""),
    document: text("document").notNull().default(""),
    phone: text("phone").notNull().default(""),
    city: text("city").notNull().default(""),
    pixKey: text("pix_key").notNull().default(""),
    monthlyGoalCents: integer("monthly_goal_cents").notNull().default(0),
    taxRateBp: integer("tax_rate_bp").notNull().default(600),
    annualLimitCents: integer("annual_limit_cents").notNull().default(8_100_000),
    plan: text("plan", { enum: ["free", "pro"] })
      .notNull()
      .default("free"),
    planExpiresAt: text("plan_expires_at"),
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
    /** Conta de demonstração criada pelo botão "Ver demonstração"; é apagada depois de 24 horas. */
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    /** Identificador da conta Google, quando a pessoa entra com o Google. */
    googleSub: text("google_sub"),
    /** Enviar lembretes automáticos por e-mail aos clientes com cobranças em aberto. */
    autoReminders: integer("auto_reminders", { mode: "boolean" }).notNull().default(true),
    /** Chave do arquivo de logo no armazenamento (R2), usada nas cobranças do plano Pro. */
    logoKey: text("logo_key"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email), uniqueIndex("users_google_sub_unique").on(table.googleSub)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const passwordResets = sqliteTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: createdAt(),
});

/** Tentativas de login erradas, para bloquear quem tenta adivinhar senhas. */
export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("login_attempts_email_idx").on(table.email, table.createdAt)],
);

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    document: text("document").notNull().default(""),
    notes: text("notes").notNull().default(""),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index("clients_user_idx").on(table.userId)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: text("status", { enum: ["ativo", "pausado", "concluido"] })
      .notNull()
      .default("ativo"),
    budgetCents: integer("budget_cents").notNull().default(0),
    dueDate: text("due_date"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [index("projects_user_idx").on(table.userId)],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    number: integer("number").notNull(),
    publicToken: text("public_token").notNull(),
    status: text("status", { enum: ["rascunho", "enviada", "paga", "cancelada"] })
      .notNull()
      .default("rascunho"),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    notes: text("notes").notNull().default(""),
    paidAt: text("paid_at"),
    createdAt: createdAt(),
  },
  (table) => [
    index("invoices_user_idx").on(table.userId),
    uniqueIndex("invoices_token_unique").on(table.publicToken),
    uniqueIndex("invoices_user_number_unique").on(table.userId, table.number),
  ],
);

export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: real("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("invoice_items_invoice_idx").on(table.invoiceId)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["receita", "despesa"] }).notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    category: text("category").notNull(),
    date: text("date").notNull(),
    status: text("status", { enum: ["pago", "pendente"] })
      .notNull()
      .default("pago"),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    /** Comprovante anexado (arquivo no R2). */
    attachmentKey: text("attachment_key"),
    attachmentName: text("attachment_name"),
    attachmentType: text("attachment_type"),
    attachmentSize: integer("attachment_size"),
    createdAt: createdAt(),
  },
  (table) => [index("transactions_user_date_idx").on(table.userId, table.date), index("transactions_invoice_idx").on(table.invoiceId)],
);

/** Orçamentos: o cliente aprova pelo link e o orçamento vira cobrança. */
export const quotes = sqliteTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    number: integer("number").notNull(),
    publicToken: text("public_token").notNull(),
    status: text("status", { enum: ["rascunho", "enviado", "aprovado", "recusado"] })
      .notNull()
      .default("rascunho"),
    issueDate: text("issue_date").notNull(),
    validUntil: text("valid_until").notNull(),
    /** Prazo de pagamento, em dias, da cobrança criada quando o cliente aprovar. */
    paymentTermDays: integer("payment_term_days").notNull().default(7),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    notes: text("notes").notNull().default(""),
    decidedAt: text("decided_at"),
    decisionNote: text("decision_note").notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [
    index("quotes_user_idx").on(table.userId),
    uniqueIndex("quotes_token_unique").on(table.publicToken),
    uniqueIndex("quotes_user_number_unique").on(table.userId, table.number),
  ],
);

export const quoteItems = sqliteTable(
  "quote_items",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: real("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("quote_items_quote_idx").on(table.quoteId)],
);

/** Lembretes de cobrança já enviados, para não mandar o mesmo lembrete duas vezes. */
export const invoiceReminders = sqliteTable(
  "invoice_reminders",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["antes", "vencimento", "atraso"] }).notNull(),
    sentAt: createdAt(),
  },
  (table) => [uniqueIndex("invoice_reminders_unique").on(table.invoiceId, table.kind)],
);

/** Pagamentos do plano Pro recebidos pelo Mercado Pago. */
export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("mercadopago"),
    status: text("status").notNull(),
    amountCents: integer("amount_cents").notNull(),
    months: integer("months").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("payments_user_idx").on(table.userId)],
);

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
