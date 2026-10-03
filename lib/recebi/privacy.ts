// LGPD: exportação de todos os dados de uma conta (direito de acesso e portabilidade, art. 18).
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  categoryRules,
  clients,
  documentEvents,
  externalPayments,
  invoiceItems,
  invoices,
  nfseDocuments,
  nfseSettings,
  notifications,
  payments,
  projects,
  quoteItems,
  quoteRequests,
  quotes,
  recurringInvoices,
  referralRewards,
  securityEvents,
  services,
  timeEntries,
  transactions,
  users,
  type User,
} from "@/db/schema";
import { openClients, openRequest, openUser } from "./sensitive";

export async function exportUserData(user: User) {
  const db = getDb();
  const id = user.id;
  const [
    clientRows,
    projectRows,
    transactionRows,
    invoiceRows,
    quoteRows,
    recurringRows,
    serviceRows,
    requestRows,
    timeRows,
    ruleRows,
    noticeRows,
    eventRows,
    securityRows,
    paymentRows,
    externalRows,
    rewardRows,
    referredRows,
    nfseConfig,
    nfseRows,
  ] = await Promise.all([
    db.select().from(clients).where(eq(clients.userId, id)),
    db.select().from(projects).where(eq(projects.userId, id)),
    db.select().from(transactions).where(eq(transactions.userId, id)),
    db.select().from(invoices).where(eq(invoices.userId, id)),
    db.select().from(quotes).where(eq(quotes.userId, id)),
    db.select().from(recurringInvoices).where(eq(recurringInvoices.userId, id)),
    db.select().from(services).where(eq(services.userId, id)),
    db.select().from(quoteRequests).where(eq(quoteRequests.userId, id)),
    db.select().from(timeEntries).where(eq(timeEntries.userId, id)),
    db.select().from(categoryRules).where(eq(categoryRules.userId, id)),
    db.select().from(notifications).where(eq(notifications.userId, id)),
    db.select().from(documentEvents).where(eq(documentEvents.userId, id)),
    db.select().from(securityEvents).where(eq(securityEvents.userId, id)),
    db.select().from(payments).where(eq(payments.userId, id)),
    db
      .select()
      .from(externalPayments)
      .where(
        // Avisos sem conta com o mesmo e-mail só entram se o e-mail da conta foi confirmado.
        user.emailVerifiedAt
          ? or(eq(externalPayments.userId, id), and(eq(externalPayments.email, user.email), isNull(externalPayments.userId)))
          : eq(externalPayments.userId, id),
      ),
    db.select().from(referralRewards).where(eq(referralRewards.referrerId, id)),
    db.select({ name: users.name, createdAt: users.createdAt }).from(users).where(eq(users.referredBy, id)),
    db.select().from(nfseSettings).where(eq(nfseSettings.userId, id)),
    db.select().from(nfseDocuments).where(eq(nfseDocuments.userId, id)),
  ]);

  const invoiceIds = invoiceRows.map((i) => i.id);
  const quoteIds = quoteRows.map((q) => q.id);
  const [invoiceItemRows, quoteItemRows] = await Promise.all([
    invoiceIds.length ? db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceIds)) : [],
    quoteIds.length ? db.select().from(quoteItems).where(inArray(quoteItems.quoteId, quoteIds)) : [],
  ]);

  // Segredos de acesso não fazem parte da exportação.
  const profile: Partial<User> = { ...(await openUser(user)) };
  for (const secret of ["passwordHash", "totpSecret", "totpRecoveryCodes", "googleSub"] as const) delete profile[secret];

  return {
    sobre: "Exportação dos seus dados no Recebi (LGPD, art. 18). Valores em dinheiro estão em centavos.",
    geradoEm: new Date().toISOString(),
    conta: { ...profile, conectadaAoGoogle: !!user.googleSub, verificacaoEmDuasEtapas: !!user.totpEnabledAt },
    clientes: await openClients(clientRows),
    projetos: projectRows,
    lancamentos: transactionRows,
    cobrancas: invoiceRows.map((invoice) => ({ ...invoice, itens: invoiceItemRows.filter((item) => item.invoiceId === invoice.id) })),
    orcamentos: quoteRows.map((quote) => ({ ...quote, itens: quoteItemRows.filter((item) => item.quoteId === quote.id) })),
    cobrancasRecorrentes: recurringRows,
    servicosDaPaginaPublica: serviceRows,
    pedidosDeOrcamento: await Promise.all(requestRows.map(openRequest)),
    horasRegistradas: timeRows,
    regrasDeCategoria: ruleRows,
    avisos: noticeRows,
    historicoDosDocumentos: eventRows,
    atividadesDeSeguranca: securityRows,
    pagamentosDoPlano: paymentRows,
    avisosDePagamentoExternos: externalRows,
    indicacoes: { pessoasIndicadas: referredRows, recompensas: rewardRows },
    notaFiscal: {
      configuracao: nfseConfig.map((config) => ({ ...config, token: config.token ? "(configurado)" : "" })),
      notas: nfseRows,
    },
  };
}
