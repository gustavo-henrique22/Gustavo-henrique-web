import assert from "node:assert/strict";
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
