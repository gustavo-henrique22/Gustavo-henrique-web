import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/recebi/invoice-status";
import { PageHeader } from "@/components/recebi/page-header";
import { QuickChargeButton } from "@/components/recebi/quick-charge";
import { StatCard } from "@/components/recebi/stat-card";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { APP_PATH, FREE_LIMITS } from "@/lib/recebi/config";
import { countInvoicesInMonth, invoiceStats, listClients, listInvoices } from "@/lib/recebi/data";
import { currentMonth, formatDate } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cobranças" };

const TABS = [
  { value: undefined, label: "Todas" },
  { value: "enviada", label: "Aguardando" },
  { value: "vencida", label: "Vencidas" },
  { value: "paga", label: "Pagas" },
  { value: "rascunho", label: "Rascunhos" },
  { value: "cancelada", label: "Canceladas" },
];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; novo?: string }> }) {
  const user = await requireUser();
  const { status, novo } = await searchParams;
  const clientOptions = await listClients(user.id);
  const active = TABS.find((t) => t.value === status)?.value;
  const [rows, stats, usedThisMonth] = await Promise.all([
    listInvoices(user.id, active),
    invoiceStats(user.id),
    countInvoicesInMonth(user.id, currentMonth()),
  ]);
  const pro = hasPro(user);

  return (
    <>
      <PageHeader
        title="Cobranças"
        description={
          pro
            ? "Crie cobranças com link e Pix para seus clientes."
            : `${usedThisMonth} de ${FREE_LIMITS.invoicesPerMonth} cobranças usadas este mês no plano Grátis.`
        }
        actions={
          <>
            <QuickChargeButton clients={clientOptions} defaultOpen={novo === "rapida"} />
            <Button asChild>
              <Link href={`${APP_PATH}/cobrancas/nova`}>
                <Plus /> Nova cobrança
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Aguardando pagamento" value={formatMoney(stats.open)} tone="warning" />
        <StatCard label="Vencidas" value={formatMoney(stats.overdue)} tone="expense" />
        <StatCard label="Pagas este mês" value={formatMoney(stats.paid)} tone="income" />
      </div>

      {!user.pixKey ? (
        <p className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          Cadastre sua chave Pix em{" "}
          <Link href={`${APP_PATH}/configuracoes`} className="font-semibold underline">
            Configurações
          </Link>{" "}
          para que suas cobranças tenham QR Code de pagamento.
        </p>
      ) : null}

      <nav aria-label="Filtrar por status" className="mb-4 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 text-sm shadow-xs">
        {TABS.map((tab) => (
          <Link
            key={tab.label}
            href={tab.value ? `${APP_PATH}/cobrancas?status=${tab.value}` : `${APP_PATH}/cobrancas`}
            aria-current={active === tab.value ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground",
              active === tab.value && "bg-primary text-primary-foreground hover:text-primary-foreground",
            )}
          >
            {tab.label}
            {tab.value === "rascunho" && stats.drafts > 0 ? ` (${stats.drafts})` : ""}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </span>
          <p className="font-semibold">Nenhuma cobrança aqui</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crie uma cobrança, envie o link por WhatsApp e receba via Pix. Quando pagar, a receita entra sozinha nos lançamentos.
          </p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
          {rows.map(({ invoice, clientName }) => (
            <li key={invoice.id}>
              <Link
                href={`${APP_PATH}/cobrancas/${invoice.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-muted/50"
              >
                <span className="w-14 font-bold tabular">#{String(invoice.number).padStart(4, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{clientName ?? "Sem cliente"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {invoice.status === "paga" ? `Paga em ${formatDate(invoice.paidAt)}` : `Vence em ${formatDate(invoice.dueDate)}`}
                  </span>
                </span>
                <InvoiceStatusBadge status={invoice.status} dueDate={invoice.dueDate} />
                <span className="w-32 text-right font-bold tabular">{formatMoney(invoice.totalCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
