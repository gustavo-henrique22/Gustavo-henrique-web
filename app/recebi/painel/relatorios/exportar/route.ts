import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, projects, transactions } from "@/db/schema";
import { getAccount } from "@/lib/recebi/auth";
import { currentMonth } from "@/lib/recebi/dates";

export const dynamic = "force-dynamic";

function csvCell(value: string): string {
  // Evita que planilhas interpretem o conteúdo como fórmula.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(request: Request) {
  const user = await getAccount();
  if (!user) return new Response("Faça login para exportar.", { status: 401 });

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("ano") ?? "";
  const year = /^\d{4}$/.test(yearParam) ? yearParam : currentMonth().slice(0, 4);

  const rows = await getDb()
    .select({ t: transactions, clientName: clients.name, projectName: projects.name })
    .from(transactions)
    .leftJoin(clients, eq(clients.id, transactions.clientId))
    .leftJoin(projects, eq(projects.id, transactions.projectId))
    .where(and(eq(transactions.userId, user.id), gte(transactions.date, `${year}-01-01`), lte(transactions.date, `${year}-12-31`)))
    .orderBy(asc(transactions.date), asc(transactions.createdAt));

  const header = ["Data", "Tipo", "Descrição", "Categoria", "Cliente", "Projeto", "Situação", "Valor (R$)"];
  const lines = rows.map(({ t, clientName, projectName }) => {
    const [y, m, d] = t.date.split("-");
    const value = ((t.type === "despesa" ? -1 : 1) * t.amountCents) / 100;
    const texts = [
      `${d}/${m}/${y}`,
      t.type === "receita" ? "Receita" : "Despesa",
      t.description,
      t.category,
      clientName ?? "",
      projectName ?? "",
      t.status === "pago" ? "Pago" : "Pendente",
    ].map(csvCell);
    return [...texts, value.toFixed(2).replace(".", ",")].join(";");
  });

  // BOM + ponto e vírgula: o Excel em português abre com acentos e colunas certas.
  const body = "﻿" + [header.join(";"), ...lines].join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="recebi-lancamentos-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
