import { readEnv } from "@/lib/recebi/email";
import { handleExternalEvent } from "@/lib/recebi/external-billing";
import { parseShopify, verifyShopifySignature } from "@/lib/recebi/payment-providers";

export const dynamic = "force-dynamic";

/** Webhook da Shopify (orders/paid, refunds/create, orders/cancelled). */
export async function POST(request: Request) {
  const secret = readEnv("SHOPIFY_WEBHOOK_SECRET");
  if (!secret) return new Response("Not found", { status: 404 });
  const raw = await request.text();
  if (raw.length > 500_000) return new Response("Grande demais", { status: 413 });
  if (!(await verifyShopifySignature(raw, request.headers.get("x-shopify-hmac-sha256"), secret))) {
    return new Response("Assinatura inválida", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  const event = parseShopify(request.headers.get("x-shopify-topic") ?? "", payload);
  if (!event) return Response.json({ ok: true, ignored: true });
  const result = await handleExternalEvent(event);
  return Response.json({ ok: true, result });
}
