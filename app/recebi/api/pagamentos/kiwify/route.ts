import { readEnv } from "@/lib/recebi/email";
import { handleExternalEvent } from "@/lib/recebi/external-billing";
import { parseKiwify, verifyKiwifySignature } from "@/lib/recebi/payment-providers";

export const dynamic = "force-dynamic";

/** Webhook da Kiwify: libera, estorna ou registra o cancelamento do Pro. */
export async function POST(request: Request) {
  const token = readEnv("KIWIFY_WEBHOOK_TOKEN");
  if (!token) return new Response("Not found", { status: 404 });
  const raw = await request.text();
  if (raw.length > 200_000) return new Response("Grande demais", { status: 413 });
  const signature = new URL(request.url).searchParams.get("signature") ?? request.headers.get("x-kiwify-signature");
  if (!(await verifyKiwifySignature(raw, signature, token))) return new Response("Assinatura inválida", { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  const event = parseKiwify(payload);
  if (!event) return Response.json({ ok: true, ignored: true });
  const result = await handleExternalEvent(event);
  return Response.json({ ok: true, result });
}
