import { ArrowLeft, CalendarSync, Mail, Pause, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/recebi/action-button";
import { ConfirmAction } from "@/components/recebi/confirm-action";
import { PageHeader } from "@/components/recebi/page-header";
import { ProNotice } from "@/components/recebi/pro-notice";
import { RecurringDialog } from "@/components/recebi/recurring-dialog";
import { StatCard } from "@/components/recebi/stat-card";
import { deleteRecurring, toggleRecurring } from "@/lib/recebi/actions/recurring";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { listClients, listProjects, listRecurring } from "@/lib/recebi/data";
import { formatDate } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cobranças recorrentes" };

export default async function RecurringPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const user = await requireUser();
  const { novo } = await searchParams;
  const pro = hasPro(user);
  const [rows, clientRows, projectRows] = await Promise.all([listRecurring(user.id), listClients(user.id), listProjects(user.id)]);
  const clients = clientRows.map((c) => ({ id: c.id, name: c.name }));
  const projects = projectRows.filter((r) => r.project.status !== "concluido").map((r) => ({ id: r.project.id, name: r.project.name }));
  const active = rows.filter((r) => r.recurring.active);
  const monthly = active.reduce((sum, r) => sum + r.recurring.amountCents, 0);

  return (
    <>
      <Link
        href={`${APP_PATH}/cobrancas`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Cobranças
      </Link>
      <PageHeader
        title="Cobranças recorrentes"
        description="Para clientes mensais: o Recebi gera a cobrança todo mês, com Pix, e envia sozinho."
        actions={
          pro ? (
            <RecurringDialog
              clients={clients}
              projects={projects}
              defaultOpen={novo === "1"}
              trigger={
                <Button>
                  <Plus /> Nova recorrência
                </Button>
              }
            />
          ) : null
        }
      />

      {!pro ? (
        <ProNotice text="Cobranças recorrentes automáticas fazem parte do plano Pro. Ideal para clientes de mensalidade." />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Receita recorrente por mês"
              value={formatMoney(monthly)}
              tone="brand"
              hint="Dinheiro que entra todo mês com os contratos ativos"
            />
            <StatCard label="Contratos ativos" value={String(active.length)} icon={<Repeat />} />
            <StatCard label="Por ano" value={formatMoney(monthly * 12)} icon={<CalendarSync />} hint="Se todos continuarem ativos" />
          </div>

          {rows.length === 0 ? (
            <section className="rounded-2xl border border-dashed bg-card p-10 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#c9ff3c] text-[#101c34]">
                <Repeat className="size-7" />
              </span>
              <h2 className="mt-4 text-lg font-bold">Nenhuma cobrança recorrente ainda</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Tem cliente que paga todo mês? Crie uma recorrência e nunca mais esqueça de cobrar.
              </p>
            </section>
          ) : (
            <ul className="grid gap-3">
              {rows.map(({ recurring, clientName, clientEmail, lastInvoiceNumber }) => (
                <li
                  key={recurring.id}
                  className={cn(
                    "flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center",
                    !recurring.active && "opacity-60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {clientName ?? "Cliente"}
                      {!recurring.active ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">Pausada</span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{recurring.description}</p>
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Todo dia {recurring.dayOfMonth} · vence em {recurring.dueDays} {recurring.dueDays === 1 ? "dia" : "dias"}
                      </span>
                      {recurring.active ? (
                        <span className="font-semibold text-foreground">Próxima: {formatDate(recurring.nextDate)}</span>
                      ) : null}
                      {recurring.autoSend ? (
                        <span className={cn("inline-flex items-center gap-1", !clientEmail && "text-warning")}>
                          <Mail className="size-3" /> {clientEmail ? "Envio automático" : "Cliente sem e-mail: envie o link"}
                        </span>
                      ) : (
                        <span>Gera como rascunho</span>
                      )}
                      {recurring.lastInvoiceId && lastInvoiceNumber ? (
                        <Link
                          href={`${APP_PATH}/cobrancas/${recurring.lastInvoiceId}`}
                          className="font-semibold underline underline-offset-2"
                        >
                          Última: #{String(lastInvoiceNumber).padStart(4, "0")}
                        </Link>
                      ) : null}
                    </p>
                  </div>
                  <p className="font-mono text-xl font-bold tabular-nums sm:text-right">
                    {formatMoney(recurring.amountCents)}
                    <span className="block font-sans text-xs font-normal text-muted-foreground">por mês</span>
                  </p>
                  <div className="flex gap-1 sm:flex-col">
                    <RecurringDialog
                      clients={clients}
                      projects={projects}
                      recurring={recurring}
                      trigger={
                        <Button variant="ghost" size="sm" className="justify-start">
                          <Pencil /> Editar
                        </Button>
                      }
                    />
                    <ActionButton
                      action={toggleRecurring}
                      fields={{ id: recurring.id }}
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                    >
                      {recurring.active ? (
                        <>
                          <Pause /> Pausar
                        </>
                      ) : (
                        <>
                          <Play /> Reativar
                        </>
                      )}
                    </ActionButton>
                    <ConfirmAction
                      action={deleteRecurring}
                      fields={{ id: recurring.id }}
                      title="Excluir esta cobrança recorrente?"
                      description="As próximas cobranças deixam de ser geradas. As que já foram geradas continuam na sua lista."
                      confirmLabel="Excluir"
                      trigger={
                        <Button variant="ghost" size="sm" className="justify-start text-muted-foreground hover:text-destructive">
                          <Trash2 /> Excluir
                        </Button>
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
