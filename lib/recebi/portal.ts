// Portal do cliente (Pro): um link fixo onde o cliente vê todas as cobranças, orçamentos e recibos.
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, invoices, quotes, users } from "@/db/schema";
import { hasPro } from "./auth";
import { BASE_PATH } from "./config";
import { openClient, openUser } from "./sensitive";

export const portalPath = (token: string) => `${BASE_PATH}/portal/${token}`;

export async function getPortal(token: string) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  const db = getDb();
  const [row] = await db
    .select({ client: clients, owner: users })
    .from(clients)
    .innerJoin(users, eq(users.id, clients.userId))
    .where(eq(clients.portalToken, token))
    .limit(1);
  // O portal é recurso Pro: se o dono voltou para o Grátis, o link deixa de abrir.
  if (!row || !hasPro(row.owner) || row.owner.isDemo) return null;
  const [invoiceRows, quoteRows] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(
        and(eq(invoices.userId, row.owner.id), eq(invoices.clientId, row.client.id), ne(invoices.status, "rascunho"), isNull(invoices.linkDisabledAt)),
      )
      .orderBy(desc(invoices.issueDate))
      .limit(100),
    db
      .select()
      .from(quotes)
      .where(and(eq(quotes.userId, row.owner.id), eq(quotes.clientId, row.client.id), ne(quotes.status, "rascunho")))
      .orderBy(desc(quotes.issueDate))
      .limit(100),
  ]);
  return { client: await openClient(row.client), owner: await openUser(row.owner), invoices: invoiceRows, quotes: quoteRows };
}
