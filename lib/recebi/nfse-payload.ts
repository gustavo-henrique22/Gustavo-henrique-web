// Montagem dos pedidos de NFS-e para a API da Focus NFe e leitura das respostas. Código puro (testável).
//
// Dois padrões:
// - "nacional" (NFS-e Nacional, obrigatório para MEI): POST /v2/nfsen, campos "planos" do layout DPS.
// - "municipal" (prefeituras com sistema próprio): POST /v2/nfse, com prestador/tomador/servico.
// Confira os campos exigidos pela sua cidade no guia da Focus NFe e teste sempre em homologação primeiro.

export type NfseLayout = "nacional" | "municipal";
export type NfseRegime = "mei" | "simples" | "outro";

export type NfseConfig = {
  layout: NfseLayout;
  cnpj: string;
  inscricaoMunicipal: string;
  codigoMunicipio: string;
  regime: NfseRegime;
  itemListaServico: string;
  codigoTributacao: string;
  aliquotaBp: number;
};

export type NfseService = {
  issuedAt: Date;
  description: string;
  amountCents: number;
  client: { name: string; document: string; email: string };
};

export const digits = (value: string) => value.replace(/\D/g, "");

export function focusBaseUrl(environment: "homologacao" | "producao"): string {
  return environment === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

export function focusPath(layout: NfseLayout): string {
  return layout === "nacional" ? "/v2/nfsen" : "/v2/nfse";
}

/** "2026-10-01T09:30:00-0300" no horário de Brasília. */
export function brasiliaTimestamp(date: Date): string {
  const local = new Date(date.getTime() - 3 * 3_600_000);
  return `${local.toISOString().slice(0, 19)}-0300`;
}

/** O que falta configurar para emitir. Lista vazia = pronto. */
export function missingConfig(config: NfseConfig): string[] {
  const missing: string[] = [];
  if (digits(config.cnpj).length !== 14) missing.push("CNPJ (14 números)");
  if (digits(config.codigoMunicipio).length !== 7)
    missing.push("código IBGE do município (7 números)");
  if (
    config.layout === "nacional" &&
    digits(config.codigoTributacao).length !== 6
  )
    missing.push("código de tributação nacional (6 números)");
  if (config.layout === "municipal" && !digits(config.itemListaServico))
    missing.push("item da lista de serviço");
  if (
    config.layout === "municipal" &&
    config.regime !== "mei" &&
    config.aliquotaBp <= 0
  )
    missing.push("alíquota do ISS");
  return missing;
}

function tomadorDocument(document: string): { cpf?: string; cnpj?: string } {
  const value = digits(document);
  if (value.length === 11) return { cpf: value };
  if (value.length === 14) return { cnpj: value };
  return {};
}

/** Opção do Simples Nacional no layout nacional: 1 não optante, 2 MEI, 3 ME/EPP. */
function opcaoSimples(regime: NfseRegime): number {
  return regime === "mei" ? 2 : regime === "simples" ? 3 : 1;
}

export function buildNfsePayload(
  config: NfseConfig,
  service: NfseService,
): Record<string, unknown> {
  const amount = Math.round(service.amountCents) / 100;
  const description =
    service.description.trim().slice(0, 2000) || "Prestação de serviços";
  const doc = tomadorDocument(service.client.document);
  const municipio = digits(config.codigoMunicipio);

  if (config.layout === "nacional") {
    return {
      data_emissao: brasiliaTimestamp(service.issuedAt),
      data_competencia: brasiliaTimestamp(service.issuedAt).slice(0, 10),
      codigo_municipio_emissora: municipio,
      cnpj_prestador: digits(config.cnpj),
      ...(digits(config.inscricaoMunicipal)
        ? { inscricao_municipal_prestador: digits(config.inscricaoMunicipal) }
        : {}),
      codigo_opcao_simples_nacional: opcaoSimples(config.regime),
      regime_especial_tributacao: 0,
      ...(doc.cpf ? { cpf_tomador: doc.cpf } : {}),
      ...(doc.cnpj ? { cnpj_tomador: doc.cnpj } : {}),
      razao_social_tomador: service.client.name.slice(0, 150),
      ...(service.client.email ? { email_tomador: service.client.email } : {}),
      codigo_municipio_prestacao: municipio,
      codigo_tributacao_nacional_iss: digits(config.codigoTributacao),
      descricao_servico: description,
      valor_servico: amount,
      tributacao_iss: 1,
    };
  }

  return {
    data_emissao: brasiliaTimestamp(service.issuedAt),
    natureza_operacao: "1",
    optante_simples_nacional: config.regime !== "outro",
    prestador: {
      cnpj: digits(config.cnpj),
      inscricao_municipal: digits(config.inscricaoMunicipal),
      codigo_municipio: municipio,
    },
    tomador: {
      ...doc,
      razao_social: service.client.name.slice(0, 150),
      ...(service.client.email ? { email: service.client.email } : {}),
    },
    servico: {
      aliquota: config.aliquotaBp / 100,
      discriminacao: description,
      iss_retido: false,
      item_lista_servico: digits(config.itemListaServico),
      ...(config.codigoTributacao
        ? { codigo_tributario_municipio: config.codigoTributacao.trim() }
        : {}),
      valor_servicos: amount,
    },
  };
}

export type NfseStatus = "processando" | "autorizado" | "erro" | "cancelado";

export type NfseResult = {
  status: NfseStatus;
  numero: string;
  codigoVerificacao: string;
  pdfUrl: string;
  xmlUrl: string;
  message: string;
};

const text = (value: unknown) =>
  typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : "";

/** Lê a resposta da Focus NFe (emissão, consulta ou cancelamento). */
export function parseFocusResponse(body: unknown, baseUrl: string): NfseResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const raw = text(b.status);
  const status: NfseStatus =
    raw === "autorizado"
      ? "autorizado"
      : raw === "cancelado"
        ? "cancelado"
        : raw.startsWith("erro") || b.erros || b.codigo
          ? "erro"
          : "processando";
  const errors = Array.isArray(b.erros)
    ? (b.erros as Record<string, unknown>[])
    : [];
  const message = errors.length
    ? errors
        .map((e) =>
          [text(e.mensagem), text(e.correcao)].filter(Boolean).join(" — "),
        )
        .join(" · ")
    : text(b.mensagem) || text(b.mensagem_sefaz);
  const absolute = (path: string) =>
    !path
      ? ""
      : /^https?:\/\//.test(path)
        ? path
        : `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  return {
    status,
    numero: text(b.numero),
    codigoVerificacao: text(b.codigo_verificacao),
    pdfUrl: absolute(
      text(b.url_danfse) || text(b.caminho_pdf_nota_fiscal) || text(b.url),
    ),
    xmlUrl: absolute(text(b.caminho_xml_nota_fiscal)),
    message: message.slice(0, 1000),
  };
}
