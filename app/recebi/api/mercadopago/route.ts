import { billingEnabled, processPayment, verifyWebhookSignature } from "@/lib/recebi/billing";

export const dynamic = "force-dynamic";

/** Notificações (webhooks) do Mercado Pago sobre pagamentos do plano Pro. */
export async function POST(request: Request) {
  if (!billingEnabled()) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = await request.json();
  } catch {
    // Algumas notificações chegam só com parâmetros na URL.
  }
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (type !== "payment" || !dataId) return Response.json({ ok: true, ignored: true });
  if (!(await verifyWebhookSignature(request, dataId))) return new Response("Assinatura inválida", { status: 401 });

  const result = await processPayment(dataId);
  return Response.json({ ok: true, result });
}
