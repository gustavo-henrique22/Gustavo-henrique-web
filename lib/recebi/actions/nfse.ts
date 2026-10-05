"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { nfseSettings } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { logEvent } from "../activity";
import { hasPro, requireUser } from "../auth";
import { APP_PATH } from "../config";
import { getInvoice } from "../data";
import { encryptField } from "../encryption";
import { parseMoney } from "../money";
import {
  cancelNfse,
  checkNfseConnection,
  emitNfse,
  getNfseDocument,
  getNfseSettings,
  NfseBusyError,
  nfseMissing,
  refreshNfse,
  tokenContext,
} from "../nfse";
import { digits } from "../nfse-payload";
import { sqliteTimestamp, takeRateLimit } from "../rate-limit";
import { logSecurityEvent } from "../security";
import { openClient } from "../sensitive";

const SETTINGS_PATH = `${APP_PATH}/configuracoes/nota-fiscal`;

async function requireProUser() {
  const user = await requireUser();
  if (user.isDemo) return { user, error: "Crie sua conta para emitir notas fiscais." };
  if (!hasPro(user)) return { user, error: "A emissão de nota fiscal faz parte do plano Pro." };
  return { user, error: null };
}

function pick<T extends string>(value: string, options: readonly T[], fallback: T): T {
  return (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

export async function saveNfseSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, error } = await requireProUser();
  if (error) return fail(error);
  // Token e dados fiscais são do dono da conta: membros da equipe não mexem.
  if (user.teamRole) return fail("Só o dono da conta configura a nota fiscal.");

  const layout = pick(text(formData, "layout", 20), ["nacional", "municipal"] as const, "nacional");
  const environment = pick(text(formData, "environment", 20), ["homologacao", "producao"] as const, "homologacao");
  const regime = pick(text(formData, "regime", 20), ["mei", "simples", "outro"] as const, "mei");
  const cnpj = digits(text(formData, "cnpj", 30));
  const inscricaoMunicipal = text(formData, "inscricaoMunicipal", 30).replace(/[^\dA-Za-z]/g, "");
  const codigoMunicipio = digits(text(formData, "codigoMunicipio", 10));
  const itemListaServico = text(formData, "itemListaServico", 10).replace(/[^\d.]/g, "");
  const codigoTributacao = text(formData, "codigoTributacao", 30).replace(/[^\dA-Za-z.]/g, "");
  const descricaoPadrao = text(formData, "descricaoPadrao", 2000);
  const aliquotaInput = text(formData, "aliquota", 10).replace("%", "").replace(",", ".");
  const aliquota = aliquotaInput ? Number(aliquotaInput) : 0;
  const tokenInput = text(formData, "token", 200).replace(/\s/g, "");

  if (cnpj && cnpj.length !== 14) return fail("O CNPJ precisa ter 14 números.");
  if (codigoMunicipio && codigoMunicipio.length !== 7) return fail("O código IBGE do município tem 7 números.");
  if (!Number.isFinite(aliquota) || aliquota < 0 || aliquota > 5) return fail("A alíquota do ISS fica entre 0% e 5%.");
  if (tokenInput && !/^[A-Za-z0-9_-]{16,120}$/.test(tokenInput)) return fail("Esse token não parece um token da Focus NFe.");

  const current = await getNfseSettings(user.id);
  const token = tokenInput ? await encryptField(tokenInput, tokenContext(user.id)) : (current?.token ?? "");
  const values = {
    layout,
    environment,
    token,
    cnpj,
    inscricaoMunicipal,
    codigoMunicipio,
    regime,
    itemListaServico,
    codigoTributacao,
    aliquotaBp: Math.round(aliquota * 100),
    descricaoPadrao,
    updatedAt: sqliteTimestamp(Date.now()),
  };
  await getDb()
    .insert(nfseSettings)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: nfseSettings.userId, set: values });

  const changedEnvironment = current && current.environment !== environment;
  await logSecurityEvent(
    user.id,
    "nfse-configurada",
    [tokenInput ? "token novo" : "", environment === "producao" ? "produção" : "homologação"].filter(Boolean).join(" · "),
  );
  revalidatePath(SETTINGS_PATH);
  if (environment === "producao" && changedEnvironment) return success("Salvo. Atenção: agora as notas são reais (produção).");
  return success("Configuração da nota fiscal salva.");
}

export async function testNfseConnection(): Promise<ActionState> {
  const { user, error } = await requireProUser();
  if (error) return fail(error);
  if (!(await takeRateLimit(`nfse-test:${user.id}`, 10, 3_600_000))) return fail("Muitos testes seguidos. Tente de novo em uma hora.");
  const settings = await getNfseSettings(user.id);
  if (!settings?.token) return fail("Salve o token da Focus NFe primeiro.");
  const result = await checkNfseConnection(settings);
  return result.ok ? success(result.message) : fail(result.message);
}

export async function emitInvoiceNfse(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, error } = await requireProUser();
  if (error) return fail(error);
  const invoiceId = text(formData, "id", 64);
  const description = text(formData, "description", 2000);
  const amountCents = parseMoney(text(formData, "amount", 30));

  const data = await getInvoice(user.id, invoiceId);
  if (!data) return fail("Cobrança não encontrada.");
  const { invoice } = data;
  if (invoice.status !== "enviada" && invoice.status !== "paga") return fail("Emita a nota de cobranças enviadas ou pagas.");
  if (!description) return fail("Descreva o serviço prestado.");
  if (amountCents === null || amountCents <= 0) return fail("Informe o valor do serviço.");

  const settings = await getNfseSettings(user.id);
  const missing = nfseMissing(settings);
  if (!settings || missing.length) return fail(`Falta configurar: ${missing.join(", ")}.`);
  if (!(await takeRateLimit(`nfse-emit:${user.id}`, 30, 3_600_000))) return fail("Muitas notas em pouco tempo. Tente de novo em uma hora.");

  const client = data.client ? await openClient(data.client) : null;
  try {
    const doc = await emitNfse(settings, invoice.id, {
      issuedAt: new Date(),
      description,
      amountCents,
      client: { name: client?.name ?? "Consumidor", document: client?.document ?? "", email: client?.email ?? "" },
    });
    await logEvent(user.id, "cobranca", invoice.id, "nfse", doc.status === "erro" ? "Recusada pela prefeitura" : "Pedida à prefeitura");
    revalidatePath(`${APP_PATH}/cobrancas/${invoice.id}`);
    if (doc.status === "erro") return fail(doc.message || "A nota não foi aceita. Veja o motivo e tente de novo.");
    if (doc.status === "autorizado") return success("Nota fiscal autorizada! 🎉");
    return success("Pedido enviado. A prefeitura costuma autorizar em alguns instantes.");
  } catch (err) {
    if (err instanceof NfseBusyError) return fail(err.message);
    throw err;
  }
}

async function loadDocument(formData: FormData) {
  const { user, error } = await requireProUser();
  if (error) return { error };
  const doc = await getNfseDocument(user.id, text(formData, "id", 64));
  const settings = await getNfseSettings(user.id);
  if (!doc || !settings) return { error: "Nota fiscal não encontrada." };
  return { user, doc, settings };
}

export async function refreshInvoiceNfse(_: ActionState, formData: FormData): Promise<ActionState> {
  const loaded = await loadDocument(formData);
  if (!loaded.doc) return fail(loaded.error);
  const { user, doc, settings } = loaded;
  if (!(await takeRateLimit(`nfse-refresh:${user.id}`, 60, 3_600_000))) return fail("Muitas consultas seguidas. Espere alguns minutos.");
  const updated = await refreshNfse(settings, doc);
  if (doc.invoiceId) revalidatePath(`${APP_PATH}/cobrancas/${doc.invoiceId}`);
  if (updated.status === "autorizado" && doc.status !== "autorizado" && doc.invoiceId) {
    await logEvent(user.id, "cobranca", doc.invoiceId, "nfse", `Nº ${updated.numero || "—"} autorizada`);
  }
  if (updated.status === "autorizado") return success("Nota fiscal autorizada.");
  if (updated.status === "erro") return fail(updated.message || "A nota não foi autorizada.");
  if (updated.status === "cancelado") return success("Esta nota está cancelada.");
  return success("Ainda em processamento na prefeitura. Tente de novo em alguns minutos.");
}

export async function cancelInvoiceNfse(_: ActionState, formData: FormData): Promise<ActionState> {
  const loaded = await loadDocument(formData);
  if (!loaded.doc) return fail(loaded.error);
  const { user, doc, settings } = loaded;
  const reason = text(formData, "reason", 255);
  if (doc.status !== "autorizado") return fail("Só notas autorizadas podem ser canceladas.");
  if (reason.length < 15) return fail("Explique o motivo com pelo menos 15 caracteres (exigência da prefeitura).");
  if (!(await takeRateLimit(`nfse-cancel:${user.id}`, 10, 3_600_000))) return fail("Muitas tentativas. Tente de novo em uma hora.");
  const result = await cancelNfse(settings, doc, reason);
  if (doc.invoiceId) {
    if (result.ok) await logEvent(user.id, "cobranca", doc.invoiceId, "nfse", `Nº ${doc.numero || "—"} cancelada`);
    revalidatePath(`${APP_PATH}/cobrancas/${doc.invoiceId}`);
  }
  return result.ok ? success(result.message) : fail(result.message);
}
