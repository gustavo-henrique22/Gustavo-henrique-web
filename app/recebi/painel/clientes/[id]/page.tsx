import { ArrowLeft, FileText, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/recebi/invoice-status";
import { NewTransactionButton } from "@/components/recebi/transaction-dialogs";
import { getDb } from "@/db";
import { invoices, transactions } from "@/db/schema";
import { requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { getClient, listClients, listProjects } from "@/lib/recebi/data";
import { formatDate, formatDateShort } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(user.id, id);
  if (!client) notFound();

  const db = getDb();
  const [history, clientInvoices, clients, projectRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), eq(transactions.clientId, id)))
      .orderBy(desc(transactions.date))
      .limit(100),
    db
      .select()
      .from(invoices)
      .where(and(eq(invoices.userId, user.id), eq(invoices.clientId, id)))
      .orderBy(desc(invoices.number))
      .limit(50),
    listClients(user.id),
    listProjects(user.id),
  ]);
  const projects = projectRows.filter((r) => r.project.clientId === id);
  const paid = history.filter((t) => t.type === "receita" && t.status === "pago").reduce((s, t) => s + t.amountCents, 0);
  const pending = history.filter((t) => t.type === "receita" && t.status === "pendente").reduce((s, t) => s + t.amountCents, 0);

  return (
    <>
      <Link
        href={`${APP_PATH}/clientes`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {client.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{client.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
              {client.email ? (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3.5" /> {client.email}
                </span>
              ) : null}
              {client.phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5" /> {client.phone}
                </span>
              ) : null}
              {client.document ? <span>Doc.: {client.document}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewTransactionButton
            type="receita"
            clients={clients}
            projects={projectRows.map((r) => r.project)}
            defaultClientId={client.id}
            label="Lançar receita"
          />
          <Button asChild variant="outline">
            <Link href={`${APP_PATH}/cobrancas/nova?cliente=${client.id}`}>
              <FileText /> Nova cobrança
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Total recebido</p>
          <p className="mt-1 text-2xl font-extrabold text-income tabular">{formatMoney(paid)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">A receber</p>
          <p className="mt-1 text-2xl font-extrabold tabular">{formatMoney(pending)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Cliente desde</p>
          <p className="mt-1 text-2xl font-extrabold tabular">{formatDate(client.createdAt.slice(0, 10))}</p>
        </div>
      </div>

      {client.notes ? (
        <div className="mb-6 rounded-2xl border bg-card p-5 text-sm whitespace-pre-line shadow-xs">
          <p className="mb-1 font-bold">Observações</p>
          {client.notes}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="mb-3 font-bold">Histórico financeiro</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento com este cliente.</p>
          ) : (
            <ul className="divide-y">
              {history.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-12 shrink-0 text-xs font-bold uppercase text-muted-foreground">{formatDateShort(t.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{t.description}</span>
                  {t.status === "pendente" ? <Badge variant="outline">Pendente</Badge> : null}
                  <span className={cn("font-semibold tabular", t.type === "receita" ? "text-income" : "text-expense")}>
                    {t.type === "receita" ? "+" : "−"} {formatMoney(t.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="grid content-start gap-4">
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h2 className="mb-3 font-bold">Cobranças</h2>
            {clientInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma cobrança para este cliente.</p>
            ) : (
              <ul className="divide-y">
                {clientInvoices.map((inv) => (
                  <li key={inv.id}>
                    <Link href={`${APP_PATH}/cobrancas/${inv.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:underline">
                      <span className="font-semibold">#{String(inv.number).padStart(4, "0")}</span>
                      <span className="flex-1 text-muted-foreground">vence {formatDate(inv.dueDate)}</span>
                      <InvoiceStatusBadge status={inv.status} dueDate={inv.dueDate} />
                      <span className="font-semibold tabular">{formatMoney(inv.totalCents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h2 className="mb-3 font-bold">Projetos</h2>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum projeto com este cliente.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {projects.map(({ project }) => (
                  <li key={project.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{project.name}</span>
                    <span className="tabular text-muted-foreground">{formatMoney(project.budgetCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
