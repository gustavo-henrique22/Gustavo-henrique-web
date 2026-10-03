// Emissão de NFS-e pela Focus NFe (https://focusnfe.com.br). Cada pessoa usa o próprio token da Focus NFe,
// guardado criptografado. A montagem dos pedidos fica em nfse-payload.ts (código puro, testado).
import { and, desc, eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { nfseDocuments, nfseSettings, type NfseDocument, type NfseSettings } from "@/db/schema";
import { notify } from "./activity";
import { APP_PATH } from "./config";
import { readEnv } from "./email";
import { decryptField } from "./encryption";
import { formatMoney } from "./money";
import {
  buildNfsePayload,
  focusBaseUrl,
  focusPath,
  missingConfig,
  parseFocusResponse,
  type NfseConfig,
  type NfseLayout,
  type NfseResult,
  type NfseService,
} from "./nfse-payload";
import { sqliteTimestamp } from "./rate-limit";

const TIMEOUT_MS = 15_000;

export const tokenContext = (userId: string) => `nfse.token:${userId}`;

export async function getNfseSettings(userId: string): Promise<NfseSettings | null> {
  const [row] = await getDb().select().from(nfseSettings).where(eq(nfseSettings.userId, userId)).limit(1);
  return row ?? null;
}

export function configOf(settings: NfseSettings): NfseConfig {
  return {
    layout: settings.layout,
    cnpj: settings.cnpj,
    inscricaoMunicipal: settings.inscricaoMunicipal,
    codigoMunicipio: settings.codigoMunicipio,
    regime: settings.regime,
    itemListaServico: settings.itemListaServico,
    codigoTributacao: settings.codigoTributacao,
    aliquotaBp: settings.aliquotaBp,
  };
}

/** O que falta para emitir (inclui o token). Lista vazia = pronto. */
export function nfseMissing(settings: NfseSettings | null): string[] {
  if (!settings) return ["configuração da nota fiscal"];
  const missing = missingConfig(configOf(settings));
  if (!settings.token) missing.unshift("token da Focus NFe");
  return missing;
}

export function nfseToken(settings: NfseSettings): Promise<string> {
  return decryptField(settings.token, tokenContext(settings.userId));
}

/** Endereço da API. FOCUS_NFE_BASE_URL serve só para testes locais com um servidor simulado. */
function baseUrl(environment: string): string {
  return readEnv("FOCUS_NFE_BASE_URL") || focusBaseUrl(environment === "producao" ? "producao" : "homologacao");
}

type FocusReply = { status: number; body: unknown };

async function focusRequest(environment: string, token: string, method: string, path: string, body?: unknown): Promise<FocusReply> {
  const response = await fetch(`${baseUrl(environment)}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${token}:`)}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const raw = await response.text();
  let parsed: unknown = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = { mensagem: raw.slice(0, 300) };
  }
  return { status: response.status, body: parsed };
}

function authError(status: number): string | null {
  if (status === 401 || status === 403)
    return "A Focus NFe recusou o token. Confira se ele é do ambiente escolhido (homologação ou produção).";
  return null;
}

/** Confere se o token funciona consultando uma nota que não existe (404 = token aceito). */
export async function checkNfseConnection(settings: NfseSettings): Promise<{ ok: boolean; message: string }> {
  const token = await nfseToken(settings);
  if (!token) return { ok: false, message: "Cadastre o token da Focus NFe primeiro." };
  try {
    const reply = await focusRequest(settings.environment, token, "GET", `${focusPath(settings.layout)}/recebi-teste-de-conexao`);
    const denied = authError(reply.status);
    if (denied) return { ok: false, message: denied };
    if (reply.status === 404 || reply.status < 300) return { ok: true, message: "Conexão com a Focus NFe funcionando." };
    return { ok: false, message: `A Focus NFe respondeu com erro (${reply.status}). Tente de novo em alguns minutos.` };
  } catch {
    return { ok: false, message: "Não conseguimos falar com a Focus NFe agora. Tente de novo em alguns minutos." };
  }
}

export async function listInvoiceNfse(userId: string, invoiceId: string): Promise<NfseDocument[]> {
  return getDb()
    .select()
    .from(nfseDocuments)
    .where(and(eq(nfseDocuments.userId, userId), eq(nfseDocuments.invoiceId, invoiceId)))
    .orderBy(desc(nfseDocuments.createdAt));
}

export async function getNfseDocument(userId: string, id: string): Promise<NfseDocument | null> {
  const [row] = await getDb()
    .select()
    .from(nfseDocuments)
    .where(and(eq(nfseDocuments.userId, userId), eq(nfseDocuments.id, id)))
    .limit(1);
  return row ?? null;
}

async function saveResult(id: string, result: Partial<NfseResult>) {
  const [row] = await getDb()
    .update(nfseDocuments)
    .set({ ...result, updatedAt: sqliteTimestamp(Date.now()) })
    .where(eq(nfseDocuments.id, id))
    .returning();
  return row;
}

export class NfseBusyError extends Error {}

/**
 * Pede a emissão da nota. A linha é criada antes (status "processando"); um índice único impede duas notas
 * em andamento para a mesma cobrança. A prefeitura costuma autorizar em segundos ou minutos: o status é
 * atualizado pelo botão "Atualizar" e pelas tarefas automáticas do dia.
 */
export async function emitNfse(settings: NfseSettings, invoiceId: string, service: NfseService): Promise<NfseDocument> {
  const token = await nfseToken(settings);
  const id = crypto.randomUUID();
  const ref = `recebi-${id.replace(/-/g, "").slice(0, 20)}`;
  const db = getDb();
  try {
    await db.insert(nfseDocuments).values({
      id,
      userId: settings.userId,
      invoiceId,
      ref,
      layout: settings.layout,
      environment: settings.environment,
      status: "processando",
      amountCents: service.amountCents,
      updatedAt: sqliteTimestamp(Date.now()),
    });
  } catch {
    throw new NfseBusyError("Esta cobrança já tem uma nota em andamento ou autorizada.");
  }

  const payload = buildNfsePayload(configOf(settings), service);
  try {
    const reply = await focusRequest(settings.environment, token, "POST", `${focusPath(settings.layout)}?ref=${ref}`, payload);
    const denied = authError(reply.status);
    if (denied) return saveResult(id, { status: "erro", message: denied });
    const result = parseFocusResponse(reply.body, baseUrl(settings.environment));
    if (reply.status >= 400 && result.status === "processando") result.status = "erro";
    if (result.status === "erro" && !result.message) result.message = `A Focus NFe recusou o pedido (${reply.status}).`;
    return saveResult(id, result);
  } catch {
    // Sem resposta: o pedido pode ter chegado. Fica "processando" e a consulta seguinte esclarece.
    return saveResult(id, { message: "A Focus NFe demorou para responder. Clique em Atualizar em alguns minutos." });
  }
}

/** Consulta a situação da nota na Focus NFe e guarda o resultado. */
export async function refreshNfse(settings: NfseSettings, doc: NfseDocument): Promise<NfseDocument> {
  const token = await nfseToken(settings);
  try {
    const reply = await focusRequest(doc.environment, token, "GET", `${focusPath(doc.layout as NfseLayout)}/${doc.ref}`);
    const denied = authError(reply.status);
    if (denied) return saveResult(doc.id, { message: denied });
    if (reply.status === 404) {
      return saveResult(doc.id, { status: "erro", message: "A Focus NFe não recebeu esta nota. Você pode emitir de novo." });
    }
    const result = parseFocusResponse(reply.body, baseUrl(doc.environment));
    // Pedido de cancelamento recusado: a nota continua autorizada.
    if (doc.status === "autorizado" && result.status === "erro") return saveResult(doc.id, { message: result.message });
    return saveResult(doc.id, result);
  } catch {
    return doc;
  }
}

/** Cancela uma nota autorizada. A justificativa precisa ter de 15 a 255 caracteres. */
export async function cancelNfse(
  settings: NfseSettings,
  doc: NfseDocument,
  justificativa: string,
): Promise<{ ok: boolean; message: string }> {
  const token = await nfseToken(settings);
  try {
    const reply = await focusRequest(doc.environment, token, "DELETE", `${focusPath(doc.layout as NfseLayout)}/${doc.ref}`, {
      justificativa,
    });
    const denied = authError(reply.status);
    if (denied) return { ok: false, message: denied };
    const result = parseFocusResponse(reply.body, baseUrl(doc.environment));
    if (result.status === "cancelado") {
      await saveResult(doc.id, { status: "cancelado", message: "" });
      return { ok: true, message: "Nota fiscal cancelada." };
    }
    const message = result.message || `A prefeitura não aceitou o cancelamento (${reply.status}).`;
    await saveResult(doc.id, { message });
    return { ok: false, message };
  } catch {
    return { ok: false, message: "Não conseguimos falar com a Focus NFe agora. Tente de novo em alguns minutos." };
  }
}

/** Tarefa automática: atualiza notas que ficaram "processando" e avisa quando forem autorizadas. */
export async function refreshPendingNfse(limit = 50): Promise<number> {
  const db = getDb();
  const pending = await db
    .select({ doc: nfseDocuments, settings: nfseSettings })
    .from(nfseDocuments)
    .innerJoin(nfseSettings, eq(nfseSettings.userId, nfseDocuments.userId))
    .where(and(eq(nfseDocuments.status, "processando"), lt(nfseDocuments.updatedAt, sqliteTimestamp(Date.now() - 60_000))))
    .limit(limit);
  let authorized = 0;
  for (const { doc, settings } of pending) {
    const updated = await refreshNfse(settings, doc);
    if (updated.status === "autorizado") {
      authorized++;
      await notify(doc.userId, {
        type: "nfse",
        title: `Nota fiscal ${updated.numero ? `nº ${updated.numero} ` : ""}autorizada`,
        body: `${formatMoney(doc.amountCents)}${doc.environment === "homologacao" ? " · ambiente de teste" : ""}`,
        href: doc.invoiceId ? `${APP_PATH}/cobrancas/${doc.invoiceId}#nota-fiscal` : `${APP_PATH}/cobrancas`,
      });
    } else if (updated.status === "erro") {
      await notify(doc.userId, {
        type: "nfse",
        title: "A nota fiscal não foi autorizada",
        body: updated.message.slice(0, 140) || "Veja o motivo na cobrança.",
        href: doc.invoiceId ? `${APP_PATH}/cobrancas/${doc.invoiceId}#nota-fiscal` : `${APP_PATH}/cobrancas`,
      });
    }
  }
  return authorized;
}
