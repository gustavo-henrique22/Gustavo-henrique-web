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
    /** Valor da hora usado no controle de horas (centavos). */
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
    /** Endereço da página pública: /recebi/p/<slug>. */
    slug: text("slug"),
    publicProfile: integer("public_profile", { mode: "boolean" }).notNull().default(false),
    headline: text("headline").notNull().default(""),
    bio: text("bio").notNull().default(""),
    /** Receber o resumo do mês por e-mail. */
    monthlySummary: integer("monthly_summary", { mode: "boolean" }).notNull().default(true),
    /** Quando a pessoa confirmou o e-mail pelo link enviado. */
    emailVerifiedAt: text("email_verified_at"),
    /** Código para o "Indique e ganhe" e quem indicou esta conta. */
    referralCode: text("referral_code"),
    referredBy: text("referred_by"),
    /** A pessoa escondeu o guia de primeiros passos. */
    onboardingDismissedAt: text("onboarding_dismissed_at"),
    /** Verificação em duas etapas (segredo criptografado e códigos de recuperação em hash). */
    totpSecret: text("totp_secret"),
    totpEnabledAt: text("totp_enabled_at"),
    totpRecoveryCodes: text("totp_recovery_codes").notNull().default(""),
    /** País do último login (cabeçalho da Cloudflare), para avisar sobre acesso de outro país. */
    lastLoginCountry: text("last_login_country").notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_google_sub_unique").on(table.googleSub),
    uniqueIndex("users_slug_unique").on(table.slug),
    uniqueIndex("users_referral_code_unique").on(table.referralCode),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    /** Aparelho (cookie de longa duração, guardado como hash), navegador e rede do login. */
    deviceId: text("device_id"),
    userAgent: text("user_agent").notNull().default(""),
    ip: text("ip").notNull().default(""),
    lastSeenAt: text("last_seen_at"),
    /** Última vez que a pessoa confirmou a identidade nesta sessão (para telas sensíveis). */
    reauthAt: text("reauth_at"),
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
    /** Valor da hora deste projeto; 0 usa o valor padrão da conta. */
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
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
    /** Primeira vez que o cliente abriu o link e quantas vezes abriu. */
    viewedAt: text("viewed_at"),
    viewCount: integer("view_count").notNull().default(0),
    /** Cobrança gerada por uma recorrência mensal. */
    recurringId: text("recurring_id"),
    /** Link público desativado pelo dono (o cliente vê "link indisponível"). */
    linkDisabledAt: text("link_disabled_at"),
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
    /** Identificador do lançamento no extrato importado (evita importar duas vezes). */
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (table) => [
    index("transactions_user_date_idx").on(table.userId, table.date),
    index("transactions_invoice_idx").on(table.invoiceId),
    index("transactions_external_idx").on(table.userId, table.externalId),
  ],
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
    viewedAt: text("viewed_at"),
    viewCount: integer("view_count").notNull().default(0),
    /** Aceite eletrônico: nome digitado pelo cliente e endereço de rede no momento da aprovação. */
    acceptedName: text("accepted_name"),
    acceptedIp: text("accepted_ip"),
    /** Link público desativado pelo dono (o cliente vê "link indisponível"). */
    linkDisabledAt: text("link_disabled_at"),
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

/** Linha do tempo de orçamentos e cobranças (criado, enviado, visualizado, aprovado, pago…). */
export const documentEvents = sqliteTable(
  "document_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentType: text("document_type", { enum: ["orcamento", "cobranca"] }).notNull(),
    documentId: text("document_id").notNull(),
    type: text("type").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [index("document_events_doc_idx").on(table.documentId, table.createdAt)],
);

/** Avisos no sininho do painel. */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href").notNull().default(""),
    readAt: text("read_at"),
    createdAt: createdAt(),
  },
  (table) => [index("notifications_user_idx").on(table.userId, table.createdAt)],
);

/** Controle de horas: cada linha é um período trabalhado (endedAt nulo = cronômetro rodando). */
export const timeEntries = sqliteTable(
  "time_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    description: text("description").notNull().default(""),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("time_entries_user_idx").on(table.userId, table.startedAt)],
);

/** Regras de categorização automática: "se a descrição contém X, use a categoria Y". */
export const categoryRules = sqliteTable(
  "category_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pattern: text("pattern").notNull(),
    type: text("type", { enum: ["receita", "despesa"] }).notNull(),
    category: text("category").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("category_rules_user_idx").on(table.userId)],
);

/** Cobranças recorrentes: geradas automaticamente todo mês para clientes mensais. */
export const recurringInvoices = sqliteTable(
  "recurring_invoices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dayOfMonth: integer("day_of_month").notNull().default(5),
    dueDays: integer("due_days").notNull().default(5),
    nextDate: text("next_date").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    autoSend: integer("auto_send", { mode: "boolean" }).notNull().default(true),
    lastInvoiceId: text("last_invoice_id"),
    createdAt: createdAt(),
  },
  (table) => [index("recurring_user_idx").on(table.userId), index("recurring_next_idx").on(table.active, table.nextDate)],
);

/** Serviços exibidos na página pública do freelancer. */
export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull().default(0),
    priceType: text("price_type", { enum: ["fixo", "a-partir", "hora", "consulta"] })
      .notNull()
      .default("a-partir"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("services_user_idx").on(table.userId)],
);

/** Pedidos de orçamento enviados pela página pública. */
export const quoteRequests = sqliteTable(
  "quote_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: text("service_id").references(() => services.id, { onDelete: "set null" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    message: text("message").notNull().default(""),
    status: text("status", { enum: ["novo", "respondido", "arquivado"] })
      .notNull()
      .default("novo"),
    createdAt: createdAt(),
  },
  (table) => [index("quote_requests_user_idx").on(table.userId, table.createdAt)],
);

/** Aparelhos onde a pessoa já entrou, para avisar sobre login em aparelho novo. */
export const knownDevices = sqliteTable(
  "known_devices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceHash: text("device_hash").notNull(),
    userAgent: text("user_agent").notNull().default(""),
    lastSeenAt: text("last_seen_at"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("known_devices_unique").on(table.userId, table.deviceHash)],
);

/** Registro de atividades sensíveis da conta (login, senha, 2FA, exportação…). */
export const securityEvents = sqliteTable(
  "security_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    ip: text("ip").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    detail: text("detail").notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [index("security_events_user_idx").on(table.userId, table.createdAt)],
);

/** Links de uso único enviados por e-mail (ex.: confirmar o e-mail). O id é o hash do token. */
export const emailTokens = sqliteTable(
  "email_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: createdAt(),
  },
  (table) => [index("email_tokens_user_idx").on(table.userId)],
);

/** Login aguardando o código da verificação em duas etapas. O id é o hash do token. */
export const loginChallenges = sqliteTable("login_challenges", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  attempts: integer("attempts").notNull().default(0),
  /** Como a pessoa passou pela primeira etapa (senha, google ou redefinicao). */
  method: text("method").notNull().default("senha"),
  /** Para onde voltar depois do código. */
  next: text("next").notNull().default(""),
  expiresAt: text("expires_at").notNull(),
  createdAt: createdAt(),
});

/** Meses de Pro ganhos por indicação (um por pessoa indicada que assinou). */
export const referralRewards = sqliteTable(
  "referral_rewards",
  {
    id: text("id").primaryKey(),
    referrerId: text("referrer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referredId: text("referred_id").notNull(),
    months: integer("months").notNull().default(1),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("referral_rewards_referred_unique").on(table.referredId),
    index("referral_rewards_referrer_idx").on(table.referrerId),
  ],
);

/** Avisos de pagamento de plataformas externas (Kiwify, Shopify). Sem conta encontrada, o admin vincula. */
export const externalPayments = sqliteTable(
  "external_payments",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    event: text("event").notNull(),
    status: text("status").notNull(),
    email: text("email").notNull().default(""),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    amountCents: integer("amount_cents").notNull().default(0),
    months: integer("months").notNull().default(0),
    handledAt: text("handled_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("external_payments_unique").on(table.provider, table.externalId, table.event),
    index("external_payments_email_idx").on(table.email),
  ],
);

/** Configuração da nota fiscal de serviço (NFS-e) pela Focus NFe. O token fica criptografado. */
export const nfseSettings = sqliteTable("nfse_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  layout: text("layout", { enum: ["nacional", "municipal"] })
    .notNull()
    .default("nacional"),
  environment: text("environment", { enum: ["homologacao", "producao"] })
    .notNull()
    .default("homologacao"),
  token: text("token").notNull().default(""),
  cnpj: text("cnpj").notNull().default(""),
  inscricaoMunicipal: text("inscricao_municipal").notNull().default(""),
  codigoMunicipio: text("codigo_municipio").notNull().default(""),
  regime: text("regime", { enum: ["mei", "simples", "outro"] })
    .notNull()
    .default("mei"),
  itemListaServico: text("item_lista_servico").notNull().default(""),
  codigoTributacao: text("codigo_tributacao").notNull().default(""),
  aliquotaBp: integer("aliquota_bp").notNull().default(0),
  descricaoPadrao: text("descricao_padrao").notNull().default(""),
  updatedAt: text("updated_at"),
});

/** Notas fiscais emitidas a partir das cobranças. */
export const nfseDocuments = sqliteTable(
  "nfse_documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    ref: text("ref").notNull(),
    layout: text("layout", { enum: ["nacional", "municipal"] })
      .notNull()
      .default("nacional"),
    environment: text("environment").notNull(),
    status: text("status").notNull(),
    numero: text("numero").notNull().default(""),
    codigoVerificacao: text("codigo_verificacao").notNull().default(""),
    pdfUrl: text("pdf_url").notNull().default(""),
    xmlUrl: text("xml_url").notNull().default(""),
    message: text("message").notNull().default(""),
    amountCents: integer("amount_cents").notNull().default(0),
    updatedAt: text("updated_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("nfse_documents_ref_unique").on(table.ref),
    index("nfse_documents_invoice_idx").on(table.invoiceId),
    // Uma cobrança só pode ter uma nota em andamento ou autorizada por vez (evita nota duplicada no clique duplo).
    uniqueIndex("nfse_documents_active_invoice")
      .on(table.invoiceId)
      .where(sql`${table.status} in ('processando', 'autorizado')`),
  ],
);

/** Chaves de acesso (passkeys): login com digital, rosto ou PIN do aparelho. */
export const passkeys = sqliteTable(
  "passkeys",
  {
    /** Id da credencial (base64url). */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: text("transports").notNull().default(""),
    name: text("name").notNull().default(""),
    lastUsedAt: text("last_used_at"),
    createdAt: createdAt(),
  },
  (table) => [index("passkeys_user_idx").on(table.userId)],
);

/** Desafios de passkey (cadastro e login), válidos por 5 minutos. O id é o hash do token do cookie. */
export const passkeyChallenges = sqliteTable("passkey_challenges", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),
  challenge: text("challenge").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: createdAt(),
});

/** Registro do que os administradores fizeram (dar Pro, vincular pagamento...). */
export const adminAudit = sqliteTable(
  "admin_audit",
  {
    id: text("id").primaryKey(),
    adminId: text("admin_id").references(() => users.id, { onDelete: "set null" }),
    adminEmail: text("admin_email").notNull(),
    action: text("action").notNull(),
    targetEmail: text("target_email").notNull().default(""),
    detail: text("detail").notNull().default(""),
    ip: text("ip").notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [index("admin_audit_created_idx").on(table.createdAt)],
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
export type TimeEntry = typeof timeEntries.$inferSelect;
export type Service = typeof services.$inferSelect;
export type RecurringInvoice = typeof recurringInvoices.$inferSelect;
export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type ExternalPayment = typeof externalPayments.$inferSelect;
export type NfseSettings = typeof nfseSettings.$inferSelect;
export type NfseDocument = typeof nfseDocuments.$inferSelect;
export type Passkey = typeof passkeys.$inferSelect;
export type AdminAudit = typeof adminAudit.$inferSelect;
