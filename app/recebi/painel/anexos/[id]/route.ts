import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { transactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/recebi/auth";
import { readFile } from "@/lib/recebi/files";

export const dynamic = "force-dynamic";

/** Abre o comprovante de um lançamento (só para o dono). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Faça login para ver o comprovante.", { status: 401 });
  const { id } = await params;
  const [row] = await getDb()
    .select({ key: transactions.attachmentKey, name: transactions.attachmentName, type: transactions.attachmentType })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .limit(1);
  if (!row?.key) return new Response("Comprovante não encontrado.", { status: 404 });
  const file = await readFile(row.key);
  if (!file) return new Response("Comprovante não encontrado.", { status: 404 });

  const filename = (row.name ?? "comprovante").replace(/[^\w.\- ]/g, "_");
  return new Response(file.body, {
    headers: {
      "Content-Type": row.type ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
