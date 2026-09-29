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
