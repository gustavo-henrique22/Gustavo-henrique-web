import { FileSignature, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuoteStatusBadge } from "@/components/recebi/invoice-status";
import { PageHeader } from "@/components/recebi/page-header";
import { StatCard } from "@/components/recebi/stat-card";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { APP_PATH, FREE_LIMITS } from "@/lib/recebi/config";
import { countQuotesInMonth, listQuotes, quoteStats } from "@/lib/recebi/data";
import { currentMonth, formatDate } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orçamentos" };

const TABS = [
  { value: undefined, label: "Todos" },
  { value: "enviado", label: "Aguardando" },
  { value: "aprovado", label: "Aprovados" },
  { value: "recusado", label: "Recusados" },
  { value: "expirado", label: "Expirados" },
  { value: "rascunho", label: "Rascunhos" },
];

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser();
  const { status } = await searchParams;
  const active = TABS.find((t) => t.value === status)?.value;
  const [rows, stats, usedThisMonth] = await Promise.all([
    listQuotes(user.id, active),
    quoteStats(user.id),
    countQuotesInMonth(user.id, currentMonth()),
  ]);
  const pro = hasPro(user);

  return (
    <>
      <PageHeader
        title="Orçamentos"
        description={
          pro
            ? "Envie propostas com link. Quando o cliente aprovar, a cobrança com Pix é criada sozinha."
            : `${usedThisMonth} de ${FREE_LIMITS.quotesPerMonth} orçamentos usados este mês no plano Grátis.`
        }
        actions={
          <Button asChild>
            <Link href={`${APP_PATH}/orcamentos/novo`}>
              <Plus /> Novo orçamento
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Aguardando resposta" value={formatMoney(stats.waiting)} tone="warning" />
        <StatCard label="Aprovados este mês" value={formatMoney(stats.approvedMonth)} tone="income" />
        <StatCard
          label="Taxa de aprovação"
          value={stats.approvalRate === null ? "—" : `${stats.approvalRate}%`}
          hint={
            stats.approvalRate === null ? "Aparece depois das primeiras respostas" : `${stats.approved} de ${stats.decided} respondidos`
          }
        />
      </div>

      <nav aria-label="Filtrar por status" className="mb-4 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 text-sm shadow-xs">
        {TABS.map((tab) => (
          <Link
            key={tab.label}
            href={tab.value ? `${APP_PATH}/orcamentos?status=${tab.value}` : `${APP_PATH}/orcamentos`}
            aria-current={active === tab.value ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground",
              active === tab.value && "bg-primary text-primary-foreground hover:text-primary-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted">
            <FileSignature className="size-5 text-muted-foreground" />
          </span>
          <p className="font-semibold">Nenhum orçamento aqui</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Mande um orçamento com link. O cliente aprova com um clique e a cobrança com Pix é criada automaticamente.
          </p>
          <Button asChild className="mt-5">
            <Link href={`${APP_PATH}/orcamentos/novo`}>
              <Plus /> Criar orçamento
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
          {rows.map(({ quote, clientName }) => (
            <li key={quote.id}>
              <Link
                href={`${APP_PATH}/orcamentos/${quote.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-muted/50"
              >
                <span className="w-14 font-bold tabular">#{String(quote.number).padStart(4, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{clientName ?? "Sem cliente"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {quote.status === "aprovado" || quote.status === "recusado"
                      ? `Respondido em ${formatDate(quote.decidedAt?.slice(0, 10))}`
                      : `Válido até ${formatDate(quote.validUntil)}`}
                  </span>
                </span>
                <QuoteStatusBadge status={quote.status} validUntil={quote.validUntil} />
                <span className="w-32 text-right font-bold tabular">{formatMoney(quote.totalCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
