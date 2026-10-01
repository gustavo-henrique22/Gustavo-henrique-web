// Linha do tempo dos documentos e avisos (sininho) do painel.
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { documentEvents, invoices, notifications, quotes } from "@/db/schema";

export type DocumentType = "orcamento" | "cobranca";

export const EVENT_LABELS: Record<string, string> = {
  criado: "Criado",
  enviado: "Liberado para o cliente",
  email: "Enviado por e-mail",
  visualizado: "Cliente abriu o link",
  aprovado: "Aprovado pelo cliente",
  "aprovado-manual": "Aprovação registrada por você",
  recusado: "Recusado pelo cliente",
  convertido: "Virou cobrança",
  lembrete: "Lembrete enviado ao cliente",
  pago: "Pagamento registrado",
  "pagamento-desfeito": "Pagamento desfeito",
  cancelado: "Cancelado",
  recorrente: "Gerada pela cobrança recorrente",
  "pedido-site": "Criado a partir de um pedido da sua página",
  nfse: "Nota fiscal",
  "link-desativado": "Link desativado",
  "link-reativado": "Link reativado",
  "link-trocado": "Link trocado (o antigo parou de funcionar)",
};

export async function logEvent(userId: string, documentType: DocumentType, documentId: string, type: string, detail = "") {
  await getDb()
    .insert(documentEvents)
    .values({ id: crypto.randomUUID(), userId, documentType, documentId, type, detail: detail.slice(0, 300) });
}

export async function listEvents(userId: string, documentId: string) {
  return getDb()
    .select()
    .from(documentEvents)
    .where(and(eq(documentEvents.userId, userId), eq(documentEvents.documentId, documentId)))
    .orderBy(desc(documentEvents.createdAt))
    .limit(50);
}

export async function notify(userId: string, data: { type: string; title: string; body?: string; href?: string }) {
  await getDb()
    .insert(notifications)
    .values({
      id: crypto.randomUUID(),
      userId,
      type: data.type,
      title: data.title.slice(0, 160),
      body: (data.body ?? "").slice(0, 300),
      href: data.href ?? "",
    });
}

export async function unreadNotifications(userId: string) {
  const db = getDb();
  const [items, [{ count }]] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(12),
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return { items, unread: count };
}

/** Pré-visualizações de link (WhatsApp, redes sociais) não contam como o cliente abrindo. */
const BOT_RE = /bot|crawl|spider|preview|whatsapp|facebookexternalhit|telegram|slack|discord|skype|linkedin|embedly|curl|wget/i;

/**
 * Registra que o cliente abriu um orçamento ou cobrança pública.
 * Ignora o próprio dono (logado) e robôs de pré-visualização. Avisa o dono na primeira vez.
 */
export async function recordView(
  documentType: DocumentType,
  doc: { id: string; userId: string; number: number; viewedAt: string | null },
  viewerUserId: string | null,
  clientName: string | null,
) {
  if (viewerUserId === doc.userId) return;
  const h = await headers();
  // Clique em "Aprovar"/"Recusar" e pré-carregamentos também renderizam a página; não são uma nova visita.
  if (h.has("x-rsc-action") || h.has("next-action") || h.has("next-router-prefetch") || h.get("purpose") === "prefetch") return;
  const agent = h.get("user-agent") ?? "";
  if (!agent || BOT_RE.test(agent)) return;

  const db = getDb();
  const now = new Date().toISOString();
  const table = documentType === "orcamento" ? quotes : invoices;
  await db
    .update(table)
    .set({ viewCount: sql`${table.viewCount} + 1`, viewedAt: doc.viewedAt ?? now })
    .where(eq(table.id, doc.id));

  // Na linha do tempo, no máximo uma visualização por hora para não poluir.
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString().replace("T", " ").slice(0, 19);
  const [recent] = await db
    .select({ id: documentEvents.id })
    .from(documentEvents)
    .where(and(eq(documentEvents.documentId, doc.id), eq(documentEvents.type, "visualizado"), gte(documentEvents.createdAt, hourAgo)))
    .limit(1);
  if (!recent) await logEvent(doc.userId, documentType, doc.id, "visualizado");

  if (!doc.viewedAt) {
    const label = documentType === "orcamento" ? "o orçamento" : "a cobrança";
    const number = String(doc.number).padStart(4, "0");
    await notify(doc.userId, {
      type: "visualizado",
      title: `${clientName ?? "Seu cliente"} abriu ${label} #${number}`,
      body: documentType === "orcamento" ? "Bom momento para mandar uma mensagem e tirar dúvidas." : "Agora é só aguardar o pagamento.",
      href: `/recebi/painel/${documentType === "orcamento" ? "orcamentos" : "cobrancas"}/${doc.id}`,
    });
  }
}

/** Endereço de rede de quem fez a requisição (para o aceite eletrônico). */
export async function requestIp(): Promise<string> {
  const h = await headers();
  return (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "").slice(0, 64);
}
