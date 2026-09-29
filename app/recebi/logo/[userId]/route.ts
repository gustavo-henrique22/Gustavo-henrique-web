import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hasPro } from "@/lib/recebi/auth";
import { readFile } from "@/lib/recebi/files";

export const dynamic = "force-dynamic";

/** Logo pública do freelancer, exibida nas cobranças e orçamentos enviados aos clientes. */
export async function GET(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [owner] = await getDb()
    .select({ logoKey: users.logoKey, plan: users.plan, planExpiresAt: users.planExpiresAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!owner?.logoKey || !hasPro(owner)) return new Response("Not found", { status: 404 });
  const file = await readFile(owner.logoKey);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.body, {
    headers: {
      "Content-Type": file.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      // Uma logo SVG não pode executar scripts quando aberta diretamente.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
