// Leitura de extratos bancários (OFX e CSV) e sugestão de categorias.
// Código puro: roda no navegador (a leitura do arquivo) e no servidor (as sugestões).

export type StatementRow = {
  /** Identificador estável da transação, usado para não importar a mesma linha duas vezes. */
  externalId: string;
  date: string;
  description: string;
  /** Em centavos, com sinal: positivo entra, negativo sai. */
  amountCents: number;
};

export type ParseResult = { rows: StatementRow[]; format: "ofx" | "csv" } | { error: string };

export const MAX_IMPORT_ROWS = 500;

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Converte "1.234,56", "-1234.56", "R$ 12,00", "(35,90)" ou "35,90-" em centavos. */
export function parseStatementAmount(raw: string): number | null {
  let value = raw.replace(/r\$|\s| /gi, "");
  if (!value) return null;
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.endsWith("-")) {
    negative = true;
    value = value.slice(0, -1);
  }
  if (value.startsWith("-")) {
    negative = !negative;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }
  if (!/^[\d.,]+$/.test(value)) return null;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    // O separador que aparece por último é o decimal.
    normalized = lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (lastComma > -1) {
    normalized = value.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > -1) {
    const decimals = value.length - lastDot - 1;
    const dots = value.split(".").length - 1;
    normalized = dots === 1 && decimals <= 2 ? value : value.replace(/\./g, "");
  } else {
    normalized = value;
  }
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  const cents = Math.round(number * 100);
  return negative ? -cents : cents;
}

/** Aceita 31/12/2026, 31/12/26, 2026-12-31, 31-12-2026 e 20261231. */
export function parseStatementDate(raw: string): string | null {
  const value = raw.trim();
  let y: number, m: number, d: number;
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else if ((match = value.match(/^(\d{4})(\d{2})(\d{2})/))) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const check = new Date(`${iso}T12:00:00Z`);
  return check.getUTCDate() === d ? iso : null;
}

/** Linhas de saldo não são transações. */
function isBalanceLine(description: string) {
  return /^(saldo|sdo|saldo anterior|saldo do dia|saldo final|saldo disponivel|s a l d o)\b/.test(normalizeText(description));
}

// ---------- OFX ----------

function ofxTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return match ? match[1].trim() : "";
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

export function parseOfx(text: string): ParseResult {
  const account = ofxTag(text, "ACCTID").replace(/\W/g, "").slice(-12);
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) ?? [];
  const rows: StatementRow[] = [];
  const seen = new Map<string, number>();
  for (const block of blocks) {
    const date = parseStatementDate(ofxTag(block, "DTPOSTED"));
    const amountCents = parseStatementAmount(ofxTag(block, "TRNAMT"));
    const description = decodeEntities(ofxTag(block, "MEMO") || ofxTag(block, "NAME") || ofxTag(block, "PAYEE")).replace(/\s+/g, " ");
    if (!date || amountCents === null || amountCents === 0) continue;
    if (isBalanceLine(description)) continue;
    let fitId = ofxTag(block, "FITID") || `${date}:${amountCents}:${normalizeText(description).slice(0, 40)}`;
    // Alguns bancos repetem o FITID em transações diferentes.
    const count = seen.get(fitId) ?? 0;
    seen.set(fitId, count + 1);
    if (count > 0) fitId = `${fitId}#${count}`;
    rows.push({
      externalId: `ofx:${account}:${fitId}`.slice(0, 160),
      date,
      description: description.slice(0, 160) || "Sem descrição",
      amountCents,
    });
  }
  if (rows.length === 0) return { error: "Não encontramos transações neste arquivo OFX." };
  return { rows, format: "ofx" };
}

// ---------- CSV ----------

/** O separador mais frequente nas primeiras linhas (algumas começam com um título sem separador). */
function detectDelimiter(text: string): string {
  const sample = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 15)
    .join("\n");
  const counts = [";", ",", "\t", "|"].map((d) => [d, sample.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

export function parseCsvLines(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const HEADER_PATTERNS = {
  date: /^(data|date|dt|data (do )?lancamento|data da transacao|data movimento|data mov)/,
  amount: /^(valor|amount|quantia|montante|valor \(r\$\)|valor r\$)/,
  credit: /^(credito|entrada|entradas|creditos|valor credito)/,
  debit: /^(debito|saida|saidas|debitos|valor debito)/,
  description: /^(descricao|historico|title|titulo|lancamento|memo|estabelecimento|detalhe|detalhes|description|nome)/,
  id: /^(identificador|id|codigo|fitid|documento|n doc|numero)$/,
};

type Columns = { date: number; amount: number; credit: number; debit: number; description: number[]; id: number };

function findHeaderColumns(header: string[]): Columns | null {
  const names = header.map(normalizeText);
  const find = (re: RegExp) => names.findIndex((n) => re.test(n));
  const columns: Columns = {
    date: find(HEADER_PATTERNS.date),
    amount: find(HEADER_PATTERNS.amount),
    credit: find(HEADER_PATTERNS.credit),
    debit: find(HEADER_PATTERNS.debit),
    description: names.map((n, i) => (HEADER_PATTERNS.description.test(n) ? i : -1)).filter((i) => i >= 0),
    id: find(HEADER_PATTERNS.id),
  };
  if (columns.date < 0) return null;
  if (columns.amount < 0 && columns.credit < 0 && columns.debit < 0) return null;
  return columns;
}

/** Sem cabeçalho: descobre as colunas pelo conteúdo da primeira linha. */
function guessColumns(sample: string[]): Columns | null {
  const date = sample.findIndex((c) => parseStatementDate(c) !== null);
  const amount = sample.findIndex(
    (c, i) => i !== date && /\d/.test(c) && /[.,]\d{2}\b|^-?\d+$/.test(c) && parseStatementAmount(c) !== null,
  );
  if (date < 0 || amount < 0) return null;
  let description = -1;
  sample.forEach((c, i) => {
    if (i === date || i === amount) return;
    if (description < 0 || c.length > sample[description].length) description = i;
  });
  return { date, amount, credit: -1, debit: -1, description: description >= 0 ? [description] : [], id: -1 };
}

export function parseCsv(text: string): ParseResult {
  const table = parseCsvLines(text, detectDelimiter(text));
  if (table.length === 0) return { error: "O arquivo está vazio." };

  // Alguns bancos colocam linhas de título antes do cabeçalho: procuramos nas primeiras linhas.
  let columns: Columns | null = null;
  let start = 0;
  for (let i = 0; i < Math.min(table.length, 12); i++) {
    columns = findHeaderColumns(table[i]);
    if (columns) {
      start = i + 1;
      break;
    }
  }
  if (!columns) {
    columns = guessColumns(table[0]);
    start = 0;
  }
  if (!columns) return { error: "Não reconhecemos as colunas. O arquivo precisa ter data, descrição e valor." };

  const rows: StatementRow[] = [];
  const seen = new Map<string, number>();
  for (const cells of table.slice(start)) {
    const date = parseStatementDate(cells[columns.date] ?? "");
    let amountCents: number | null = null;
    if (columns.amount >= 0) amountCents = parseStatementAmount(cells[columns.amount] ?? "");
    else {
      const credit = parseStatementAmount(cells[columns.credit] ?? "") ?? 0;
      const debit = parseStatementAmount(cells[columns.debit] ?? "") ?? 0;
      amountCents = Math.abs(credit) - Math.abs(debit);
    }
    const description = columns.description
      .map((i) => cells[i] ?? "")
      .filter(Boolean)
      .filter((value, index, all) => all.indexOf(value) === index)
      .join(" · ")
      .replace(/\s+/g, " ")
      .trim();
    if (!date || amountCents === null || amountCents === 0) continue;
    if (isBalanceLine(description)) continue;

    const bankId = columns.id >= 0 ? (cells[columns.id] ?? "").trim() : "";
    let key = bankId || `${date}:${amountCents}:${normalizeText(description).slice(0, 60)}`;
    // Duas compras iguais no mesmo dia são transações diferentes.
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count > 0) key = `${key}#${count}`;
    rows.push({ externalId: `csv:${key}`.slice(0, 160), date, description: description.slice(0, 160) || "Sem descrição", amountCents });
  }
  if (rows.length === 0) return { error: "Não encontramos transações neste arquivo." };
  return { rows, format: "csv" };
}

export function parseStatement(text: string, fileName = ""): ParseResult {
  const clean = text.replace(/^﻿/, "");
  const isOfx = /\.ofx$|\.qfx$/i.test(fileName) || /<OFX>|OFXHEADER/i.test(clean.slice(0, 2000));
  const result = isOfx ? parseOfx(clean) : parseCsv(clean);
  if ("rows" in result && result.rows.length > MAX_IMPORT_ROWS) {
    return {
      error: `O arquivo tem ${result.rows.length} transações. Importe no máximo ${MAX_IMPORT_ROWS} por vez (exporte um período menor).`,
    };
  }
  return result;
}

// ---------- Categorias ----------

export type CategoryRule = { pattern: string; type: "receita" | "despesa"; category: string };

const EXPENSE_KEYWORDS: [string, RegExp][] = [
  [
    "Software e assinaturas",
    /adobe|figma|canva|notion|github|vercel|netlify|\baws\b|amazon web|google (workspace|one|cloud|storage)|gsuite|microsoft|office 365|dropbox|chatgpt|openai|anthropic|claude\.ai|hostinger|hostgator|locaweb|registro\.br|godaddy|shopify|slack|zoom\.us|\bzoom\b|trello|envato|freepik|shutterstock|capcut|icloud|apple\.com|framer|webflow|wix|squarespace|elementor|jetbrains|cloudflare/,
  ],
  [
    "Marketing e anúncios",
    /facebk|facebook ads|meta ads|google ads|\bads\b|instagram|linkedin|tiktok|mailchimp|rd station|impulsionamento/,
  ],
  [
    "Transporte",
    /\buber\b|\b99 ?(app|pop|taxi|tecnologia)\b|cabify|posto|combust|ipiranga|\bshell\b|petrobras|br mania|estacion|sem parar|veloe|conectcar|metro|bilhete unico|passagem|latam|gol linhas|azul linhas|pedagio/,
  ],
  [
    "Alimentação",
    /ifood|99 ?food|rappi|restaurante|lanchonete|padaria|supermerc|mercadinho|\bmercado\b(?! (pago|livre|mp))|carrefour|pao de acucar|assai|atacadao|burger|mcdonald|starbucks|\bcafe\b|ze delivery|pizzaria|hortifruti/,
  ],
  ["Internet e telefone", /\bvivo\b|\bclaro\b|\btim\b|\boi\b|net servicos|telefonica|algar|brisanet|internet|fibra/],
  ["Impostos (DAS, INSS)", /\bdas\b|simples nacional|\binss\b|\bgps\b|\bdarf\b|receita federal|\biss\b|pgmei|imposto/],
  ["Contador", /contab|contador|contabilizei|agilize|conube/],
  ["Cursos e livros", /udemy|alura|hotmart|domestika|coursera|livraria|kindle|rocketseat|eduzz|kiwify|curso|skillshare|origamid/],
  ["Coworking e escritório", /coworking|wework|regus|kalunga|papelaria|aluguel/],
  ["Taxas bancárias", /tarifa|\biof\b|juros|anuidade|\btaxa\b|manutencao de conta|pacote de servicos|cesta de servicos/],
  ["Equipamentos", /kabum|pichau|terabyte|apple store|fast shop|dell|lenovo|samsung|logitech/],
  ["Terceirizados", /freelancer|workana|99freelas|fiverr|upwork/],
];

const INCOME_KEYWORDS: [string, RegExp][] = [
  ["Reembolso", /estorno|reembolso|devolucao|cashback/],
  ["Outras receitas", /rendimento|rend pago|juros|dividendo|resgate/],
  ["Projeto", /pix recebido|transferencia recebida|ted recebida|doc recebido|recebimento|pagamento recebido|\bpix\b.*(recebid|de )/],
];

function matchesPattern(normalizedDescription: string, pattern: string) {
  const needle = normalizeText(pattern);
  return needle.length > 0 && normalizedDescription.includes(needle);
}

/** Categoria sugerida: primeiro as regras da pessoa, depois palavras conhecidas. */
export function suggestCategory(
  description: string,
  type: "receita" | "despesa",
  rules: CategoryRule[] = [],
): { category: string; byRule: boolean } {
  const text = normalizeText(description);
  const rule = rules.find((r) => r.type === type && matchesPattern(text, r.pattern));
  if (rule) return { category: rule.category, byRule: true };
  const table = type === "despesa" ? EXPENSE_KEYWORDS : INCOME_KEYWORDS;
  const found = table.find(([, re]) => re.test(text));
  return { category: found ? found[0] : type === "despesa" ? "Outras despesas" : "Outras receitas", byRule: false };
}

/** Procura o nome de um cliente cadastrado dentro da descrição (ex.: "PIX RECEBIDO - STUDIO LIMA LTDA"). */
export function matchClient<T extends { id: string; name: string }>(description: string, clients: T[]): T | null {
  const text = normalizeText(description);
  let best: T | null = null;
  for (const client of clients) {
    const name = normalizeText(client.name);
    if (name.length < 3 || !text.includes(name)) continue;
    if (!best || name.length > normalizeText(best.name).length) best = client;
  }
  return best;
}

const GENERIC_WORDS = new Set(
  (
    "pix compra compras pagamento pagto pag debito credito cartao transferencia transf enviado enviada enviados recebido recebida " +
    "ted doc boleto com para via ltda eireli conta saque deposito cred deb visa master mastercard elo nacional internacional " +
    "online loja parcela parc aut autorizado int tar the www cia servicos servico brasil sao paulo rio janeiro ref pgto mensal " +
    "dia data valor app pagseguro mercadopago stone cielo rede getnet sumup"
  ).split(" "),
);

/** Palavra que identifica a transação, para sugerir uma regra (ex.: "UBER *TRIP 1234" → "uber"). */
export function guessKeyword(description: string): string | null {
  const words = normalizeText(description)
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w));
  return words[0] ?? null;
}
