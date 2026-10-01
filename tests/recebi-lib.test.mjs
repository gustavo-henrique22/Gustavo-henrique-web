import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

const money = await vite.ssrLoadModule("/lib/recebi/money.ts");
const dates = await vite.ssrLoadModule("/lib/recebi/dates.ts");
const pix = await vite.ssrLoadModule("/lib/recebi/pix.ts");
const crypto = await vite.ssrLoadModule("/lib/recebi/crypto.ts");
const extenso = await vite.ssrLoadModule("/lib/recebi/extenso.ts");
const statement = await vite.ssrLoadModule("/lib/recebi/statement.ts");
const slug = await vite.ssrLoadModule("/lib/recebi/slug.ts");
const enc = await vite.ssrLoadModule("/lib/recebi/encryption-core.ts");
const pay = await vite.ssrLoadModule("/lib/recebi/payment-providers.ts");
const nfse = await vite.ssrLoadModule("/lib/recebi/nfse-payload.ts");
const totp = await vite.ssrLoadModule("/lib/recebi/totp.ts");
const passwords = await vite.ssrLoadModule("/lib/recebi/password-policy.ts");
const headers = await vite.ssrLoadModule("/lib/recebi/security-headers.ts");
const fileTypes = await vite.ssrLoadModule("/lib/recebi/file-types.ts");

test("parses money typed in Brazilian and international formats", () => {
  assert.equal(money.parseMoney("1.234,56"), 123456);
  assert.equal(money.parseMoney("R$ 1.234,56"), 123456);
  assert.equal(money.parseMoney("1234,5"), 123450);
  assert.equal(money.parseMoney("1234.56"), 123456);
  assert.equal(money.parseMoney("1,234.56"), 123456);
  assert.equal(money.parseMoney("2.400"), 240000);
  assert.equal(money.parseMoney("12.5"), 1250);
  assert.equal(money.parseMoney("124"), 12400);
  assert.equal(money.parseMoney("0,10"), 10);
  assert.equal(money.parseMoney(""), null);
  assert.equal(money.parseMoney("abc"), null);
  assert.equal(money.parseMoney("1,2,3"), 12300);
});

test("formats cents as BRL", () => {
  assert.equal(money.formatMoney(123456), "R$ 1.234,56");
  assert.equal(money.formatMoney(0), "R$ 0,00");
  assert.equal(money.centsToInput(240000), "2400,00");
  assert.equal(money.formatPercentBp(600), "6%");
  assert.equal(money.formatPercentBp(1550), "15,5%");
});

test("does month and date arithmetic without time zone drift", () => {
  assert.equal(dates.addMonths("2026-12", 1), "2027-01");
  assert.equal(dates.addMonths("2026-01", -1), "2025-12");
  assert.equal(dates.addMonths("2026-09", -5), "2026-04");
  assert.equal(dates.addMonthsToDate("2026-01-31", 1), "2026-02-28");
  assert.equal(dates.addMonthsToDate("2028-01-31", 1), "2028-02-29");
  assert.equal(dates.addDays("2026-02-27", 2), "2026-03-01");
  assert.deepEqual(dates.monthBounds("2026-02"), { start: "2026-02-01", end: "2026-02-28" });
  assert.equal(dates.isValidISODate("2026-02-30"), false);
  assert.equal(dates.isValidISODate("2026-02-28"), true);
  assert.equal(dates.isValidMonth("2026-13"), false);
  assert.equal(dates.formatDate("2026-09-28"), "28/09/2026");
  assert.equal(dates.daysBetween("2026-09-28", "2026-10-05"), 7);
  // 02:00 UTC ainda é o dia anterior em São Paulo (UTC-3).
  assert.equal(dates.todayISO(new Date("2026-09-29T02:00:00Z")), "2026-09-28");
});

test("computes the Pix CRC16 like the Banco Central example", () => {
  const example =
    "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
  assert.equal(pix.crc16(example), "1D3D");
});

test("builds a valid static Pix payload", () => {
  const payload = pix.buildPixPayload({
    key: "ana@exemplo.com",
    name: "Ana Souza Design",
    city: "São Paulo",
    amountCents: 170000,
    txid: "COB0001",
  });
  assert.match(payload, /^000201/);
  assert.ok(payload.includes("0014br.gov.bcb.pix0115ana@exemplo.com"));
  assert.ok(payload.includes("54071700.00"));
  assert.ok(payload.includes("6009Sao Paulo"));
  assert.ok(payload.includes("62110507COB0001"));
  assert.equal(pix.crc16(payload.slice(0, -4)), payload.slice(-4));
});

test("normalizes Pix keys", () => {
  assert.equal(pix.normalizePixKey("Ana@Exemplo.com "), "ana@exemplo.com");
  assert.equal(pix.normalizePixKey("(11) 98888-7777"), "+5511988887777");
  assert.equal(pix.normalizePixKey("11988887777"), "+5511988887777");
  assert.equal(pix.normalizePixKey("529.982.247-25"), "52998224725");
  assert.equal(pix.normalizePixKey("12.345.678/0001-95"), "12345678000195");
  assert.equal(pix.isValidCPF("529.982.247-25"), true);
  assert.equal(pix.isValidCPF("111.111.111-11"), false);
});

test("renders the Pix QR code as SVG", () => {
  const svg = pix.pixQrSvg("teste");
  assert.match(svg, /^<svg/);
});

test("hashes and verifies passwords", async () => {
  const hash = await crypto.hashPassword("senha-segura-123");
  assert.match(hash, /^pbkdf2\$100000\$/);
  assert.equal(await crypto.verifyPassword("senha-segura-123", hash), true);
  assert.equal(await crypto.verifyPassword("outra-senha", hash), false);
  assert.notEqual(await crypto.hashPassword("senha-segura-123"), hash);
});

test("writes money amounts in words for receipts", () => {
  assert.equal(extenso.moneyToWords(100), "um real");
  assert.equal(extenso.moneyToWords(150), "um real e cinquenta centavos");
  assert.equal(extenso.moneyToWords(1), "um centavo");
  assert.equal(extenso.moneyToWords(10000), "cem reais");
  assert.equal(extenso.moneyToWords(12345), "cento e vinte e três reais e quarenta e cinco centavos");
  assert.equal(extenso.moneyToWords(100000), "mil reais");
  assert.equal(extenso.moneyToWords(120000), "mil e duzentos reais");
  assert.equal(extenso.moneyToWords(125050), "mil duzentos e cinquenta reais e cinquenta centavos");
  assert.equal(extenso.moneyToWords(100500), "mil e cinco reais");
  assert.equal(extenso.moneyToWords(170000), "mil e setecentos reais");
  assert.equal(extenso.moneyToWords(2140000), "vinte e um mil e quatrocentos reais");
  assert.equal(extenso.moneyToWords(100000000), "um milhão de reais");
  assert.equal(extenso.moneyToWords(250000000), "dois milhões e quinhentos mil reais");
  assert.equal(extenso.moneyToWords(100010000), "um milhão e cem reais");
});

test("formats timestamps in São Paulo time and relative to now", () => {
  assert.equal(dates.formatDateTime("2026-09-28 17:20:00"), "28/09/2026 às 14:20");
  assert.equal(dates.formatDateTime("2026-09-28T17:20:00.000Z"), "28/09/2026 às 14:20");
  const now = new Date("2026-09-28T18:00:00Z");
  assert.equal(dates.formatRelative("2026-09-28 17:59:40", now), "agora");
  assert.equal(dates.formatRelative("2026-09-28 17:20:00", now), "há 40 min");
  assert.equal(dates.formatRelative("2026-09-28 12:00:00", now), "há 6 h");
  assert.equal(dates.formatRelative("2026-09-27 12:00:00", now), "ontem");
  assert.equal(dates.formatRelative("2026-09-24 12:00:00", now), "há 4 dias");
});

test("reads OFX statements (SGML, sem fechamento de tags)", () => {
  const ofx = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>0260<ACCTID>123456-7</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260901
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260905120000[-3:BRT]<TRNAMT>1800.00<FITID>abc1<MEMO>Transferência recebida - Studio Lima
</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260906<TRNAMT>-23,90<FITID>abc2<MEMO>UBER *TRIP HELP.UBER.COM
</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260906<TRNAMT>-23.90<FITID>abc2<MEMO>UBER *TRIP HELP.UBER.COM
</STMTTRN>
<STMTTRN><TRNTYPE>OTHER<DTPOSTED>20260907<TRNAMT>0.00<FITID>abc3<MEMO>Saldo
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  const result = statement.parseStatement(ofx, "extrato.ofx");
  assert.equal(result.format, "ofx");
  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.rows[0], {
    externalId: "ofx:1234567:abc1",
    date: "2026-09-05",
    description: "Transferência recebida - Studio Lima",
    amountCents: 180000,
  });
  assert.equal(result.rows[1].amountCents, -2390);
  assert.notEqual(result.rows[1].externalId, result.rows[2].externalId);
});

test("reads CSV statements from different banks", () => {
  const nubank =
    "Data,Valor,Identificador,Descrição\n05/09/2026,1500.00,id-1,Transferência recebida pelo Pix - CAFE AROMA\n06/09/2026,-124.00,id-2,Compra no débito - ADOBE\n";
  const a = statement.parseStatement(nubank, "nubank.csv");
  assert.equal(a.format, "csv");
  assert.deepEqual(
    a.rows.map((r) => [r.externalId, r.date, r.amountCents]),
    [
      ["csv:id-1", "2026-09-05", 150000],
      ["csv:id-2", "2026-09-06", -12400],
    ],
  );

  const inter =
    "Extrato Conta Corrente\nPeríodo: 01/09/2026 a 30/09/2026\n\nData Lançamento;Histórico;Descrição;Valor;Saldo\n10/09/2026;Pix enviado;Coworking Central;-450,00;1.050,00\n10/09/2026;Pix enviado;Coworking Central;-450,00;600,00\n12/09/2026;Saldo do dia;;0,00;600,00\n";
  const b = statement.parseStatement(inter, "inter.csv");
  assert.equal(b.rows.length, 2);
  assert.equal(b.rows[0].description, "Pix enviado · Coworking Central");
  assert.equal(b.rows[0].amountCents, -45000);
  assert.notEqual(b.rows[0].externalId, b.rows[1].externalId);

  const split = "data;descricao;credito;debito\n2026-09-01;Tarifa pacote;;19,90\n2026-09-02;Pix recebido;2.000,00;\n";
  const c = statement.parseStatement(split, "banco.csv");
  assert.deepEqual(
    c.rows.map((r) => r.amountCents),
    [-1990, 200000],
  );

  assert.ok("error" in statement.parseStatement("nada,aqui\nfoo,bar\n", "x.csv"));
});

test("parses statement amounts and dates", () => {
  assert.equal(statement.parseStatementAmount("R$ -1.234,56"), -123456);
  assert.equal(statement.parseStatementAmount("(35,90)"), -3590);
  assert.equal(statement.parseStatementAmount("35,90-"), -3590);
  assert.equal(statement.parseStatementAmount("1,234.56"), 123456);
  assert.equal(statement.parseStatementAmount("1.234"), 123400);
  assert.equal(statement.parseStatementAmount("abc"), null);
  assert.equal(statement.parseStatementDate("31/12/26"), "2026-12-31");
  assert.equal(statement.parseStatementDate("2026-02-30"), null);
  assert.equal(statement.parseStatementDate("20260915093000"), "2026-09-15");
});

test("suggests categories, clients and rule keywords", () => {
  assert.equal(statement.suggestCategory("UBER *TRIP", "despesa").category, "Transporte");
  assert.equal(statement.suggestCategory("Pagamento Adobe Systems", "despesa").category, "Software e assinaturas");
  assert.equal(statement.suggestCategory("MERCADO PAGO *LOJA", "despesa").category, "Outras despesas");
  assert.equal(statement.suggestCategory("DAS - Simples Nacional", "despesa").category, "Impostos (DAS, INSS)");
  assert.equal(statement.suggestCategory("Pix recebido de Fulano", "receita").category, "Projeto");
  const rules = [{ pattern: "uber", type: "despesa", category: "Terceirizados" }];
  assert.deepEqual(statement.suggestCategory("Úber trip", "despesa", rules), { category: "Terceirizados", byRule: true });
  const clients = [
    { id: "1", name: "Studio" },
    { id: "2", name: "Studio Lima" },
  ];
  assert.equal(statement.matchClient("PIX RECEBIDO STUDIO LIMA LTDA", clients).id, "2");
  assert.equal(statement.guessKeyword("Compra no débito - UBER *TRIP 1234"), "uber");
  assert.equal(statement.guessKeyword("PIX 123"), null);
});

test("computes monthly recurring dates", () => {
  assert.equal(dates.dateInMonth("2026-02", 31), "2026-02-28");
  assert.equal(dates.dateInMonth("2028-02", 30), "2028-02-29");
  assert.equal(dates.firstMonthlyDate("2026-09-29", 5), "2026-10-05");
  assert.equal(dates.firstMonthlyDate("2026-09-05", 5), "2026-09-05");
  assert.equal(dates.nextMonthlyDate("2026-01-31", 31), "2026-02-28");
  assert.equal(dates.nextMonthlyDate("2026-02-28", 31), "2026-03-31");
  assert.equal(dates.nextMonthlyDate("2026-12-10", 10), "2027-01-10");
});

test("builds public page addresses", () => {
  assert.equal(slug.slugify("Marina Costa Design"), "marina-costa-design");
  assert.equal(slug.slugify("  João & Cia. — Fotografia! "), "joao-cia-fotografia");
  assert.equal(slug.isValidSlug("marina-costa"), true);
  assert.equal(slug.isValidSlug("ab"), false);
  assert.equal(slug.isValidSlug("admin"), false);
  assert.equal(slug.isValidSlug("-marina"), false);
  assert.equal(slug.isValidSlug("mar--ina"), false);
});

test("encrypts sensitive fields with AES-GCM bound to their context", async () => {
  const key = "chave-de-teste-com-mais-de-32-caracteres!!";
  const other = "outra-chave-de-teste-com-mais-de-32-caracteres";
  const sealed = await enc.encryptWith(key, "123.456.789-09", "users.document:u1");
  assert.ok(sealed.startsWith("enc:v1:"));
  assert.ok(!sealed.includes("123.456"));
  assert.notEqual(sealed, await enc.encryptWith(key, "123.456.789-09", "users.document:u1"));
  assert.equal(await enc.decryptWith([key], sealed, "users.document:u1"), "123.456.789-09");
  assert.equal(await enc.decryptWith([key], sealed, "users.document:u2"), "");
  assert.equal(await enc.decryptWith([other], sealed, "users.document:u1"), "");
  assert.equal(await enc.decryptWith([other, key], sealed, "users.document:u1"), "123.456.789-09");
  assert.equal(await enc.decryptWith([key], "texto antigo", "x"), "texto antigo");
  assert.equal(await enc.encryptWith(undefined, "sem chave", "x"), "sem chave");
  assert.equal(await enc.encryptWith("curta", "sem chave", "x"), "sem chave");
  assert.equal(await enc.needsReencryptionWith(other, sealed), true);
  assert.equal(await enc.needsReencryptionWith(key, sealed), false);
});

test("reads and verifies Kiwify payment notices", async () => {
  const body = JSON.stringify({
    order_id: "kiw-123",
    order_status: "paid",
    webhook_event_type: "order_approved",
    Customer: { full_name: "Ana Lima", email: "Ana@Exemplo.com" },
    Commissions: { charge_amount: 19900 },
    Product: { product_name: "Recebi Pro" },
    Subscription: { id: "sub-1", plan: { name: "Plano Anual", frequency: "yearly" } },
    TrackingParameters: { sck: "0b6c1d2e-1111-4222-8333-444455556666" },
  });
  const token = "token-kiwify";
  const signature = createHmac("sha1", token).update(body).digest("hex");
  assert.equal(await pay.verifyKiwifySignature(body, signature, token), true);
  assert.equal(await pay.verifyKiwifySignature(body, signature, "outro"), false);
  assert.equal(await pay.verifyKiwifySignature(body.replace("19900", "99900"), signature, token), false);
  assert.equal(await pay.verifyKiwifySignature(body, null, token), false);
  const pretty = JSON.stringify(JSON.parse(body), null, 2);
  assert.equal(await pay.verifyKiwifySignature(pretty, signature, token), true);

  const event = pay.parseKiwify(JSON.parse(body));
  assert.equal(event.kind, "pagamento");
  assert.equal(event.months, 12);
  assert.equal(event.amountCents, 19900);
  assert.equal(event.email, "Ana@Exemplo.com");
  assert.equal(event.userHint, "0b6c1d2e-1111-4222-8333-444455556666");
  assert.equal(
    pay.parseKiwify({ order_id: "x", order_status: "paid", webhook_event_type: "order_approved", Commissions: { charge_amount: "19.90" } })
      .months,
    1,
  );
  assert.equal(pay.parseKiwify({ order_id: "x", order_status: "refunded", webhook_event_type: "order_refunded" }).kind, "reembolso");
  assert.equal(pay.parseKiwify({ order_id: "x", webhook_event_type: "subscription_canceled" }).kind, "cancelamento");
  assert.equal(pay.parseKiwify({ order_id: "x", order_status: "waiting_payment", webhook_event_type: "pix_created" }), null);
  assert.equal(pay.parseKiwify({ order_id: "x", order_status: "refused", webhook_event_type: "order_approved" }), null);
});

test("reads and verifies Shopify payment notices", async () => {
  const body = JSON.stringify({
    id: 820982911946154500,
    email: "joao@exemplo.com",
    financial_status: "paid",
    total_price: "19.90",
    line_items: [{ title: "Recebi Pro", variant_title: "Mensal", sku: "RECEBI-PRO-MENSAL" }],
    note_attributes: [{ name: "recebi_user", value: "abc" }],
  });
  const secret = "segredo-shopify";
  const header = createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(await pay.verifyShopifySignature(body, header, secret), true);
  assert.equal(await pay.verifyShopifySignature(body, header, "errado"), false);
  const event = pay.parseShopify("orders/paid", JSON.parse(body));
  assert.equal(event.kind, "pagamento");
  assert.equal(event.amountCents, 1990);
  assert.equal(event.months, 1);
  assert.equal(event.userHint, "abc");
  assert.equal(pay.parseShopify("orders/paid", { id: 1, financial_status: "paid", total_price: "199.00", line_items: [] }).months, 12);
  assert.equal(pay.parseShopify("refunds/create", { order_id: 1 }).kind, "reembolso");
  assert.equal(pay.parseShopify("orders/cancelled", { id: 1, financial_status: "paid" }), null);
  assert.equal(pay.parseShopify("orders/create", { id: 1 }), null);
  assert.equal(pay.toCents("R$ 1.234,56"), 123456);
  assert.equal(pay.toCents(19.9), 1990);
});

const nfseConfig = {
  layout: "nacional",
  cnpj: "12.345.678/0001-95",
  inscricaoMunicipal: "",
  codigoMunicipio: "3550308",
  regime: "mei",
  itemListaServico: "",
  codigoTributacao: "01.07.01",
  aliquotaBp: 0,
};
const nfseService = {
  issuedAt: new Date("2026-10-01T12:30:00Z"),
  description: "  Criação de identidade visual  ",
  amountCents: 150050,
  client: { name: "Padaria Pão Quente", document: "111.444.777-35", email: "contato@padaria.com.br" },
};

test("lists what is missing before issuing an NFS-e", () => {
  assert.deepEqual(nfse.missingConfig(nfseConfig), []);
  assert.deepEqual(nfse.missingConfig({ ...nfseConfig, cnpj: "123", codigoMunicipio: "", codigoTributacao: "" }), [
    "CNPJ (14 números)",
    "código IBGE do município (7 números)",
    "código de tributação nacional (6 números)",
  ]);
  const municipal = { ...nfseConfig, layout: "municipal", regime: "simples", itemListaServico: "", aliquotaBp: 0 };
  assert.deepEqual(nfse.missingConfig(municipal), ["item da lista de serviço", "alíquota do ISS"]);
  assert.deepEqual(nfse.missingConfig({ ...municipal, regime: "mei", itemListaServico: "1.07" }), []);
});

test("builds the NFS-e Nacional request for Focus NFe", () => {
  const payload = nfse.buildNfsePayload(nfseConfig, nfseService);
  assert.equal(payload.data_emissao, "2026-10-01T09:30:00-0300");
  assert.equal(payload.data_competencia, "2026-10-01");
  assert.equal(payload.cnpj_prestador, "12345678000195");
  assert.equal(payload.codigo_municipio_emissora, "3550308");
  assert.equal(payload.codigo_opcao_simples_nacional, 2);
  assert.equal(payload.cpf_tomador, "11144477735");
  assert.equal(payload.cnpj_tomador, undefined);
  assert.equal(payload.inscricao_municipal_prestador, undefined);
  assert.equal(payload.codigo_tributacao_nacional_iss, "010701");
  assert.equal(payload.descricao_servico, "Criação de identidade visual");
  assert.equal(payload.valor_servico, 1500.5);
  assert.equal(nfse.focusPath("nacional"), "/v2/nfsen");
  assert.equal(nfse.focusBaseUrl("producao"), "https://api.focusnfe.com.br");
  assert.equal(nfse.focusBaseUrl("homologacao"), "https://homologacao.focusnfe.com.br");
});

test("builds the municipal NFS-e request for Focus NFe", () => {
  const payload = nfse.buildNfsePayload(
    { ...nfseConfig, layout: "municipal", regime: "outro", inscricaoMunicipal: "12.345-6", itemListaServico: "1.07", aliquotaBp: 250 },
    { ...nfseService, client: { name: "Loja X", document: "11.222.333/0001-81", email: "" } },
  );
  assert.equal(payload.optante_simples_nacional, false);
  assert.deepEqual(payload.prestador, { cnpj: "12345678000195", inscricao_municipal: "123456", codigo_municipio: "3550308" });
  assert.deepEqual(payload.tomador, { cnpj: "11222333000181", razao_social: "Loja X" });
  assert.equal(payload.servico.aliquota, 2.5);
  assert.equal(payload.servico.item_lista_servico, "107");
  assert.equal(payload.servico.valor_servicos, 1500.5);
  assert.equal(nfse.focusPath("municipal"), "/v2/nfse");
});

test("reads Focus NFe answers", () => {
  const base = "https://homologacao.focusnfe.com.br";
  assert.equal(nfse.parseFocusResponse({ status: "processando_autorizacao" }, base).status, "processando");
  const ok = nfse.parseFocusResponse(
    {
      status: "autorizado",
      numero: 42,
      codigo_verificacao: "AB12",
      url_danfse: "https://nfse.gov.br/danfse/1",
      caminho_xml_nota_fiscal: "/arquivos/nota.xml",
    },
    base,
  );
  assert.deepEqual(ok, {
    status: "autorizado",
    numero: "42",
    codigoVerificacao: "AB12",
    pdfUrl: "https://nfse.gov.br/danfse/1",
    xmlUrl: "https://homologacao.focusnfe.com.br/arquivos/nota.xml",
    message: "",
  });
  const error = nfse.parseFocusResponse(
    { status: "erro_autorizacao", erros: [{ codigo: "E1", mensagem: "CNPJ inválido", correcao: "Confira o CNPJ" }] },
    base,
  );
  assert.equal(error.status, "erro");
  assert.equal(error.message, "CNPJ inválido — Confira o CNPJ");
  assert.equal(nfse.parseFocusResponse({ codigo: "requisicao_invalida", mensagem: "Falta campo" }, base).message, "Falta campo");
  assert.equal(nfse.parseFocusResponse({ status: "cancelado" }, base).status, "cancelado");
  // Um caminho estranho nunca vira link de outro esquema (ex.: javascript:).
  assert.equal(nfse.parseFocusResponse({ caminho_pdf_nota_fiscal: "javascript:alert(1)" }, base).pdfUrl, `${base}/javascript:alert(1)`);
});

test("generates and checks authenticator codes (RFC 6238)", async () => {
  // Vetores oficiais da RFC 6238 (SHA-1, segredo "12345678901234567890").
  const secret = totp.base32Encode(new TextEncoder().encode("12345678901234567890"));
  assert.equal(secret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.deepEqual(totp.base32Decode(secret), new TextEncoder().encode("12345678901234567890"));
  assert.equal(await totp.totpCode(secret, totp.totpCounter(59_000), 8), "94287082");
  assert.equal(await totp.totpCode(secret, totp.totpCounter(1_111_111_109_000), 8), "07081804");
  assert.equal(await totp.totpCode(secret, totp.totpCounter(20_000_000_000_000), 8), "65353130");

  const now = 1_700_000_000_000;
  const code = await totp.totpCode(secret, totp.totpCounter(now));
  assert.equal(await totp.verifyTotp(secret, code, now), totp.totpCounter(now));
  assert.equal(await totp.verifyTotp(secret, code.replace(/^(\d{3})/, "$1 "), now), totp.totpCounter(now));
  assert.equal(await totp.verifyTotp(secret, code, now + 30_000), totp.totpCounter(now)); // relógio um pouco atrasado
  assert.equal(await totp.verifyTotp(secret, code, now + 95_000), null); // código velho
  assert.equal(await totp.verifyTotp(secret, "12345", now), null);
  // Código de recuperação com 6 números no meio não vira código do app.
  assert.equal(await totp.verifyTotp(secret, "3msfd-35544", now), null);

  const fresh = totp.generateTotpSecret();
  assert.match(fresh, /^[A-Z2-7]{32}$/);
  assert.equal(totp.formatSecret("ABCDEFGH"), "ABCD EFGH");
  const uri = totp.otpauthUri({ secret: fresh, account: "ana@exemplo.com", issuer: "Recebi" });
  assert.ok(uri.startsWith("otpauth://totp/Recebi%3Aana%40exemplo.com?secret=" + fresh));

  const codes = totp.generateRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const c of codes) assert.match(c, /^[a-z2-9]{5}-[a-z2-9]{5}$/);
  assert.equal(totp.normalizeRecoveryCode(" ABCDE fghij "), "abcde-fghij");
  assert.equal(totp.normalizeRecoveryCode("abc"), "");
});

test("refuses weak and leaked passwords", async () => {
  assert.equal(passwords.weakPasswordReason("curta"), "A senha precisa ter pelo menos 8 caracteres.");
  assert.match(passwords.weakPasswordReason("12345678"), /muito comum/);
  assert.match(passwords.weakPasswordReason("Senha123"), /muito comum/);
  assert.match(passwords.weakPasswordReason("aaaaaaaaaa"), /variedade/);
  assert.match(passwords.weakPasswordReason("23456789"), /sequências/);
  assert.match(passwords.weakPasswordReason("marina.costa2026", { email: "marina.costa@exemplo.com" }), /e-mail/);
  assert.match(passwords.weakPasswordReason("Ana Souza", { name: "Ana  Souza" }), /nome/);
  assert.equal(passwords.weakPasswordReason("cafe com pao de queijo"), null);

  // "password" tem SHA-1 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8.
  const body = "1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\n0018A45C4D1DEF81644B54AB7F969B88D65:0";
  assert.equal(passwords.countInRange(body, "1e4c9b93f3f0682250b6cf8331b7ee68fd8"), 9545824);
  assert.equal(passwords.countInRange(body, "0018A45C4D1DEF81644B54AB7F969B88D65"), 0);

  const seen = [];
  const fakeFetch = async (url) => {
    seen.push(url);
    return new Response(url.endsWith("/5BAA6") ? body : "");
  };
  assert.equal(await passwords.breachCount("password", fakeFetch), 9545824);
  // Só os 5 primeiros caracteres do hash saem do servidor.
  assert.equal(seen[0], "https://api.pwnedpasswords.com/range/5BAA6");

  const phrase = "uma frase longa e boa";
  const digest = await globalThis.crypto.subtle.digest("SHA-1", new TextEncoder().encode(phrase));
  const suffix = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .slice(5);
  assert.equal(await passwords.passwordProblem(phrase, {}, async () => new Response("C0FFEE:3")), null);
  assert.match(await passwords.passwordProblem(phrase, {}, async () => new Response(`${suffix}:12`)), /vazamentos/);
  // Serviço fora do ar: não trava o cadastro.
  const offline = async () => {
    throw new Error("offline");
  };
  assert.equal(await passwords.passwordProblem(phrase, {}, offline), null);
});

test("sets strict security headers and blocks cross-site writes", () => {
  const prod = headers.securityHeaders({ nonce: "abc123", dev: false });
  const csp = prod["Content-Security-Policy"];
  assert.match(csp, /script-src 'self' 'nonce-abc123' 'strict-dynamic'/);
  assert.doesNotMatch(csp, /unsafe-inline' 'unsafe-eval|script-src[^;]*unsafe-inline/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /base-uri 'self'/);
  assert.equal(prod["Strict-Transport-Security"], "max-age=31536000");
  assert.equal(prod["X-Content-Type-Options"], "nosniff");
  assert.equal(prod["X-Frame-Options"], "SAMEORIGIN");
  assert.equal(headers.securityHeaders({ nonce: "x", dev: true })["Strict-Transport-Security"], undefined);
  assert.match(headers.createNonce(), /^[A-Za-z0-9+/]{22}==$/);
  assert.notEqual(headers.createNonce(), headers.createNonce());

  const base = { method: "POST", pathname: "/recebi/entrar", host: "meusite.com", origin: null, secFetchSite: null };
  assert.equal(headers.isCrossSiteRequest({ ...base, origin: "https://meusite.com" }), false);
  assert.equal(headers.isCrossSiteRequest({ ...base, origin: "https://golpe.com" }), true);
  assert.equal(headers.isCrossSiteRequest({ ...base, origin: "null" }), true);
  assert.equal(headers.isCrossSiteRequest({ ...base, secFetchSite: "cross-site" }), true);
  assert.equal(headers.isCrossSiteRequest({ ...base, secFetchSite: "same-site" }), true);
  assert.equal(headers.isCrossSiteRequest({ ...base, secFetchSite: "same-origin" }), false);
  assert.equal(headers.isCrossSiteRequest(base), false); // servidor para servidor
  assert.equal(headers.isCrossSiteRequest({ ...base, method: "GET", origin: "https://golpe.com" }), false);
  // Webhooks de pagamento vêm de outros servidores.
  assert.equal(headers.isCrossSiteRequest({ ...base, pathname: "/recebi/api/pagamentos/kiwify", origin: "https://kiwify.com.br" }), false);
});

test("detects real file types by their first bytes", () => {
  const b = (...v) => Uint8Array.from(v);
  const text = (t) => Uint8Array.from(t, (c) => c.charCodeAt(0));
  assert.equal(fileTypes.sniffFileType(b(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(fileTypes.sniffFileType(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "image/png");
  assert.equal(fileTypes.sniffFileType(text("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
  assert.equal(fileTypes.sniffFileType(text("\0\0\0\x18ftypheic")), "image/heic");
  assert.equal(fileTypes.sniffFileType(text("%PDF-1.7")), "application/pdf");
  assert.equal(fileTypes.sniffFileType(text("<svg xmlns=")), null);
  assert.equal(fileTypes.sniffFileType(text("MZ\x90\0")), null); // executável renomeado
  assert.equal(fileTypes.extensionFor("image/png"), "png");
});
