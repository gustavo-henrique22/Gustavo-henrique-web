import { ArrowLeftRight, Check, Clock, Download, FileUp, Paperclip, Pencil, Search, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/recebi/action-button";
import { ConfirmAction } from "@/components/recebi/confirm-action";
import { Select } from "@/components/recebi/fields";
import { MonthSwitcher } from "@/components/recebi/month-switcher";
import { PageHeader } from "@/components/recebi/page-header";
import { ReceiptScanButton } from "@/components/recebi/receipt-scan";
import { EditTransactionDialog, NewTransactionButton } from "@/components/recebi/transaction-dialogs";
import { deleteTransaction, toggleTransactionStatus } from "@/lib/recebi/actions/finance";
import { aiEnabled } from "@/lib/recebi/ai";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { listClients, listProjects, listTransactions } from "@/lib/recebi/data";
import { currentMonth, formatDateShort, isValidMonth, todayISO } from "@/lib/recebi/dates";
import { filesEnabled } from "@/lib/recebi/files";
import { formatMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Lançamentos" };

const BASE = `${APP_PATH}/lancamentos`;

type SearchParams = { mes?: string; tipo?: string; status?: string; q?: string; cliente?: string; novo?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const params = await searchParams;
  const month = isValidMonth(params.mes) ? params.mes : currentMonth();
  const type = params.tipo === "receita" || params.tipo === "despesa" ? params.tipo : undefined;
  const status = params.status === "pago" || params.status === "pendente" ? params.status : undefined;
  const search = params.q?.trim().slice(0, 80) || undefined;
  const clientId = params.cliente || undefined;

  const [rows, clients, projectRows] = await Promise.all([
    listTransactions(user.id, { month, type, status, search, clientId }),
    listClients(user.id),
    listProjects(user.id),
  ]);
  const projects = projectRows.map((r) => r.project);
  const today = todayISO();
  const attachments = !filesEnabled() ? "hidden" : hasPro(user) && !user.isDemo ? "enabled" : "locked";

  const income = rows.filter((r) => r.transaction.type === "receita").reduce((s, r) => s + r.transaction.amountCents, 0);
  const expense = rows.filter((r) => r.transaction.type === "despesa").reduce((s, r) => s + r.transaction.amountCents, 0);
  const filterParams = { tipo: type, status, q: search, cliente: clientId };

  const tabHref = (tipo?: string) => {
    const s = new URLSearchParams({ mes: month });
    if (tipo) s.set("tipo", tipo);
    if (status) s.set("status", status);
    if (search) s.set("q", search);
    if (clientId) s.set("cliente", clientId);
    return `${BASE}?${s.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Lançamentos"
        description="Todas as suas receitas e despesas."
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href={`${BASE}/importar`}>
                <FileUp /> Importar extrato
              </Link>
            </Button>
            <NewTransactionButton
              type="receita"
              clients={clients}
              projects={projects}
              attachments={attachments}
              defaultOpen={params.novo === "receita"}
            />
            <NewTransactionButton
              type="despesa"
              clients={clients}
              projects={projects}
              attachments={attachments}
              defaultOpen={params.novo === "despesa"}
            />
            {hasPro(user) && aiEnabled() ? (
              <ReceiptScanButton clients={clients} projects={projects} attach={attachments === "enabled"} />
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <MonthSwitcher month={month} basePath={BASE} params={filterParams} />
        <nav aria-label="Tipo" className="inline-flex w-fit rounded-xl border bg-card p-1 text-sm shadow-xs">
          {[
            { label: "Todos", value: undefined },
            { label: "Receitas", value: "receita" },
            { label: "Despesas", value: "despesa" },
          ].map((tab) => (
            <Link
              key={tab.label}
              href={tabHref(tab.value)}
              aria-current={type === tab.value ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground",
                type === tab.value && "bg-primary text-primary-foreground hover:text-primary-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <form method="get" action={BASE} className="mb-6 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input type="hidden" name="mes" value={month} />
        {type ? <input type="hidden" name="tipo" value={type} /> : null}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Buscar por descrição ou categoria"
            className="bg-card pl-9"
            aria-label="Buscar"
          />
        </div>
        <Select name="status" defaultValue={status ?? ""} aria-label="Situação" className="bg-card sm:w-44">
          <option value="">Qualquer situação</option>
          <option value="pago">Pagos</option>
          <option value="pendente">Pendentes</option>
        </Select>
        <Select name="cliente" defaultValue={clientId ?? ""} aria-label="Cliente" className="bg-card sm:w-44">
          <option value="">Todos os clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border bg-card p-4 text-center shadow-xs sm:text-left">
        <div>
          <p className="text-xs text-muted-foreground">Receitas</p>
          <p className="font-bold text-income tabular sm:text-lg">{formatMoney(income)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Despesas</p>
          <p className="font-bold text-expense tabular sm:text-lg">{formatMoney(expense)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className="font-bold tabular sm:text-lg">{formatMoney(income - expense)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted">
            <ArrowLeftRight className="size-5 text-muted-foreground" />
          </span>
          <p className="font-semibold">Nenhum lançamento encontrado</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {search || status || type || clientId ? "Tente mudar os filtros." : "Lance uma receita ou despesa para começar."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <ul className="divide-y">
            {rows.map(({ transaction: t, clientName, projectName, invoiceNumber }) => {
              const isIncome = t.type === "receita";
              const late = t.status === "pendente" && t.date < today;
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap">
                  <span className="w-12 shrink-0 text-center text-xs font-bold uppercase text-muted-foreground">
                    {formatDateShort(t.date)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.description}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.category}
                      {clientName ? ` · ${clientName}` : ""}
                      {projectName ? ` · ${projectName}` : ""}
                      {invoiceNumber ? ` · Cobrança #${String(invoiceNumber).padStart(4, "0")}` : ""}
                    </span>
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "hidden sm:inline-flex",
                      t.status === "pago" && "border-income/30 text-income",
                      t.status === "pendente" && !late && "border-warning/30 text-warning",
                      late && "border-destructive/40 text-destructive",
                    )}
                  >
                    {t.status === "pago" ? (isIncome ? "Recebido" : "Pago") : late ? "Atrasado" : isIncome ? "A receber" : "A pagar"}
                  </Badge>
                  <span
                    className={cn(
                      "ml-auto text-sm font-bold tabular sm:ml-0 sm:w-32 sm:text-right",
                      isIncome ? "text-income" : "text-expense",
                    )}
                  >
                    {isIncome ? "+" : "−"} {formatMoney(t.amountCents)}
                  </span>
                  <span className="-mt-1 flex w-full shrink-0 items-center justify-end gap-1 sm:mt-0 sm:w-auto">
                    <span
                      className={cn(
                        "mr-auto pl-16 text-xs font-medium sm:hidden",
                        t.status === "pago" ? "text-income" : late ? "text-destructive" : "text-warning",
                      )}
                    >
                      {t.status === "pago" ? (isIncome ? "Recebido" : "Pago") : late ? "Atrasado" : isIncome ? "A receber" : "A pagar"}
                    </span>
                    <ActionButton
                      action={toggleTransactionStatus}
                      fields={{ id: t.id }}
                      variant="ghost"
                      size="icon-sm"
                      title={t.status === "pago" ? "Marcar como pendente" : "Marcar como pago"}
                      aria-label={t.status === "pago" ? "Marcar como pendente" : "Marcar como pago"}
                    >
                      {t.status === "pago" ? <Clock /> : <Check />}
                    </ActionButton>
                    {t.attachmentKey ? (
                      <Button
                        asChild
                        variant="ghost"
                        size="icon-sm"
                        title={`Comprovante: ${t.attachmentName ?? ""}`}
                        aria-label="Ver comprovante"
                      >
                        <a href={`${APP_PATH}/anexos/${t.id}`} target="_blank" rel="noreferrer">
                          <Paperclip />
                        </a>
                      </Button>
                    ) : null}
                    <EditTransactionDialog
                      transaction={t}
                      clients={clients}
                      projects={projects}
                      attachments={attachments}
                      trigger={
                        <Button variant="ghost" size="icon-sm" title="Editar" aria-label="Editar">
                          <Pencil />
                        </Button>
                      }
                    />
                    <ConfirmAction
                      action={deleteTransaction}
                      fields={{ id: t.id }}
                      title="Excluir lançamento?"
                      description={`"${t.description}" será apagado. Isso não pode ser desfeito.`}
                      confirmLabel="Excluir"
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Excluir"
                          aria-label="Excluir"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      }
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-4 flex justify-end">
        <a
          href={`${APP_PATH}/relatorios/exportar?ano=${month.slice(0, 4)}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <Download className="size-3.5" /> Exportar lançamentos do ano (CSV)
        </a>
      </p>
    </>
  );
}
