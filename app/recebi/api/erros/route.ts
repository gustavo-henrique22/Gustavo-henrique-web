import { getCurrentUser } from "@/lib/recebi/auth";
import { logError } from "@/lib/recebi/error-log";
import { takeRateLimit } from "@/lib/recebi/rate-limit";
import { requestMeta } from "@/lib/recebi/security";

export const dynamic = "force-dynamic";

/** O navegador avisa quando uma tela do Recebi quebra. Só aceita textos curtos e poucos avisos por conexão. */
export async function POST(request: Request) {
  const { ip } = await requestMeta();
  if (!(await takeRateLimit(`erros:${ip || "local"}`, 20, 60 * 60_000))) return new Response(null, { status: 429 });
  const raw = await request.text();
  if (raw.length > 4000) return new Response(null, { status: 413 });
  let body: { message?: unknown; path?: unknown; digest?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  if (!str(body.message)) return new Response(null, { status: 400 });
  const user = await getCurrentUser();
  await logError({ source: "navegador", message: str(body.message), path: str(body.path), digest: str(body.digest), userId: user?.id ?? null });
  return new Response(null, { status: 204 });
}
