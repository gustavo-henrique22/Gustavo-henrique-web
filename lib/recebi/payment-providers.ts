// Leitura e verificação dos avisos de pagamento da Kiwify e da Shopify. Código puro (testável).
import { PRO_PRICE_CENTS, PRO_YEARLY_PRICE_CENTS } from "./config";

export type Provider = "kiwify" | "shopify";
export type PaymentKind = "pagamento" | "reembolso" | "cancelamento";

export type ExternalEvent = {
  provider: Provider;
  externalId: string;
  event: string;
  kind: PaymentKind;
  status: string;
  email: string;
  /** Id da conta no Recebi, quando a plataforma devolve o que mandamos no link. */
  userHint?: string;
  amountCents: number;
  months: number;
};

/** Mensal ou anual, pelo nome do plano ou pelo valor pago. */
export function monthsFor(amountCents: number, hint: string): number {
  if (/anual|annual|year|yearly|12\s*mes/i.test(hint)) return 12;
  if (/mensal|monthly|month/i.test(hint)) return 1;
  return amountCents >= Math.round((PRO_PRICE_CENTS + PRO_YEARLY_PRICE_CENTS) / 2) ? 12 : 1;
}

/** "19.90", 19.9, 1990 ou "R$ 19,90" em centavos. Números inteiros já vêm em centavos. */
export function toCents(value: unknown): number {
  if (typeof value === "number") return Number.isInteger(value) ? value : Math.round(value * 100);
  if (typeof value !== "string") return 0;
  const clean = value.replace(/[^\d.,]/g, "");
  if (!clean) return 0;
  if (/^\d+$/.test(clean)) return Number(clean);
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  return Math.round(Number(normalized) * 100) || 0;
}

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => (value && typeof value === "object" ? (value as Json) : {});
const str = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

const KIWIFY_EVENTS: Record<string, PaymentKind> = {
  order_approved: "pagamento",
  subscription_renewed: "pagamento",
  order_refunded: "reembolso",
  chargeback: "reembolso",
  subscription_canceled: "cancelamento",
};

/** Aviso da Kiwify (formato do webhook: order_id, webhook_event_type, Customer, Commissions, Subscription…). */
export function parseKiwify(payload: unknown): ExternalEvent | null {
  const p = obj(payload);
  const orderStatus = str(p.order_status).toLowerCase();
  const eventType =
    str(p.webhook_event_type).toLowerCase() ||
    (orderStatus === "paid" ? "order_approved" : orderStatus === "refunded" ? "order_refunded" : "");
  const kind = KIWIFY_EVENTS[eventType];
  if (!kind) return null;
  if (kind === "pagamento" && orderStatus && !["paid", "approved", "authorized"].includes(orderStatus)) return null;
  const subscription = obj(p.Subscription);
  const externalId = str(p.order_id) || str(p.subscription_id) || str(subscription.id);
  if (!externalId) return null;
  const customer = obj(p.Customer);
  const commissions = obj(p.Commissions);
  const amountCents = toCents(commissions.charge_amount ?? commissions.product_base_price ?? p.charge_amount);
  const plan = obj(subscription.plan);
  const hint = [str(plan.frequency), str(plan.name), str(obj(p.Product).product_name)].join(" ");
  const tracking = obj(p.TrackingParameters);
  return {
    provider: "kiwify",
    // Renovações trazem um pedido novo; reembolsos apontam para o pedido pago.
    externalId,
    event: eventType,
    kind,
    status: orderStatus || eventType,
    email: str(customer.email),
    userHint: str(tracking.sck) || undefined,
    amountCents,
    months: kind === "cancelamento" ? 0 : monthsFor(amountCents, hint),
  };
}

/** Aviso da Shopify pelos tópicos orders/paid, refunds/create e orders/cancelled. */
export function parseShopify(topic: string, payload: unknown): ExternalEvent | null {
  const p = obj(payload);
  if (topic === "orders/paid") {
    if (str(p.financial_status) && str(p.financial_status) !== "paid") return null;
    const orderId = str(p.id);
    if (!orderId) return null;
    const lines = Array.isArray(p.line_items) ? p.line_items.map(obj) : [];
    const hint = lines.map((l) => `${str(l.title)} ${str(l.variant_title)} ${str(l.sku)}`).join(" ");
    const attributes = Array.isArray(p.note_attributes) ? p.note_attributes.map(obj) : [];
    const userHint = str(attributes.find((a) => str(a.name) === "recebi_user")?.value) || undefined;
    const amountCents = toCents(str(p.current_total_price) || str(p.total_price));
    return {
      provider: "shopify",
      externalId: orderId,
      event: topic,
      kind: "pagamento",
      status: "paid",
      email: str(p.email) || str(p.contact_email) || str(obj(p.customer).email),
      userHint,
      amountCents,
      months: monthsFor(amountCents, hint),
    };
  }
  if (topic === "refunds/create") {
    const orderId = str(p.order_id);
    if (!orderId) return null;
    return {
      provider: "shopify",
      externalId: orderId,
      event: topic,
      kind: "reembolso",
      status: "refunded",
      email: "",
      amountCents: 0,
      months: 0,
    };
  }
  if (topic === "orders/cancelled") {
    const orderId = str(p.id);
    const financial = str(p.financial_status);
    if (!orderId || !["refunded", "voided", "partially_refunded"].includes(financial)) return null;
    return {
      provider: "shopify",
      externalId: orderId,
      event: topic,
      kind: "reembolso",
      status: financial,
      email: str(p.email),
      amountCents: 0,
      months: 0,
    };
  }
  return null;
}

// ---------- Verificação das assinaturas ----------

const encoder = new TextEncoder();

async function hmac(algorithm: "SHA-1" | "SHA-256", secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: algorithm }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/** Kiwify: HMAC-SHA1 (hex) do corpo com o token do webhook, enviado em ?signature=. */
export async function verifyKiwifySignature(rawBody: string, signature: string | null, token: string): Promise<boolean> {
  if (!signature || !token) return false;
  const expected = toHex(await hmac("SHA-1", token, rawBody));
  if (safeEqual(expected, signature.toLowerCase())) return true;
  // Algumas integrações assinam o JSON sem espaços: aceitamos também essa forma.
  try {
    const compact = JSON.stringify(JSON.parse(rawBody));
    if (compact !== rawBody) return safeEqual(toHex(await hmac("SHA-1", token, compact)), signature.toLowerCase());
  } catch {
    // corpo inválido
  }
  return false;
}

/** Shopify: HMAC-SHA256 (base64) do corpo cru com o segredo, no cabeçalho X-Shopify-Hmac-Sha256. */
export async function verifyShopifySignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  return safeEqual(toBase64(await hmac("SHA-256", secret, rawBody)), header.trim());
}
