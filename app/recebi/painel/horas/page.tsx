import { Clock, Plus, ReceiptText, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/recebi/action-button";
import { ConfirmAction } from "@/components/recebi/confirm-action";
import { FormField, Select } from "@/components/recebi/fields";
import { FormDialog } from "@/components/recebi/form-dialog";
import { PageHeader } from "@/components/recebi/page-header";
import { StatCard } from "@/components/recebi/stat-card";
import { TimerCard } from "@/components/recebi/timer";
import { addTimeEntry, billProjectHours, deleteTimeEntry } from "@/lib/recebi/actions/time";
import { requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { listProjects, listTimeEntries, runningTimer, unbilledHours } from "@/lib/recebi/data";
import { addDays, formatDateLong, todayISO } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";

export const metadata: Metadata = { title: "Controle de horas" };

function hoursLabel(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${String(m).padStart(2, "0")}min` : ""}` : `${m}min`;
}

/** Data local (São Paulo) de um instante ISO. */
function localDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export default async function HoursPage() {
  const user = await requireUser();
  const today = todayISO();
  const since = new Date(`${addDays(today, -45)}T00:00:00-03:00`).toISOString();
  const [running, entries, unbilled, projectRows] = await Promise.all([
    runningTimer(user.id),
    listTimeEntries(user.id, since),
    unbilledHours(user.id),
    listProjects(user.id),
  ]);
  const projects = projectRows.filter((r) => r.project.status !== "concluido").map((r) => ({ id: r.project.id, name: r.project.name }));

  const weekStart = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekSeconds = entries.filter((e) => localDate(e.entry.startedAt) >= weekStart).reduce((s, e) => s + e.entry.durationSeconds, 0);
  const monthSeconds = entries.filter((e) => localDate(e.entry.startedAt) >= monthStart).reduce((s, e) => s + e.entry.durationSeconds, 0);
  const unbilledValue = unbilled.reduce((sum, row) => sum + Math.round((row.seconds / 3600) * (row.rate || user.hourlyRateCents)), 0);

  const byDay = new Map<string, typeof entries>();
  for (const row of entries) {
    const day = localDate(row.entry.startedAt);
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }

  return (
    <>
      <PageHeader
        title="Controle de horas"
        description="Cronometre seu trabalho e transforme as horas em cobrança com um clique."
        actions={
          <FormDialog
            title="Lançar horas"
            description="Esqueceu de ligar o cronômetro? Lance as horas aqui."
            action={addTimeEntry}
            submitLabel="Lançar"
            trigger={
              <Button variant="outline">
                <Plus /> Lançar horas
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="te-date" label="Dia" className="sm:col-span-1">
                <Input id="te-date" name="date" type="date" required defaultValue={today} max={today} />
              </FormField>
              <FormField id="te-hours" label="Horas">
                <Input id="te-hours" name="hours" type="number" min={0} max={24} defaultValue={1} />
              </FormField>
              <FormField id="te-minutes" label="Minutos">
                <Input id="te-minutes" name="minutes" type="number" min={0} max={59} step={5} defaultValue={0} />
              </FormField>
            </div>
            <FormField id="te-project" label="Projeto">
              <Select id="te-project" name="projectId" defaultValue="">
                <option value="">Sem projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="te-description" label="Descrição">
              <Input id="te-description" name="description" maxLength={200} placeholder="Ex.: Reunião de alinhamento" />
            </FormField>
          </FormDialog>
        }
      />

      <TimerCard
        running={
          running ? { startedAt: running.entry.startedAt, description: running.entry.description, projectName: running.projectName } : null
        }
        projects={projects}
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Esta semana" value={hoursLabel(weekSeconds)} icon={<Clock />} />
        <StatCard label="Este mês" value={hoursLabel(monthSeconds)} icon={<Clock />} />
        <StatCard
          label="A faturar"
          value={formatMoney(unbilledValue)}
          tone="brand"
          hint={
            user.hourlyRateCents > 0 ? (
              `Sua hora: ${formatMoney(user.hourlyRateCents)}`
            ) : (
              <Link href={`${APP_PATH}/configuracoes#valor-hora`} className="underline">
                Defina o valor da sua hora
              </Link>
            )
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="mb-1 font-bold">Horas a faturar</h2>
          <p className="mb-4 text-xs text-muted-foreground">Viram uma cobrança em rascunho para você revisar e enviar.</p>
          {unbilled.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma hora pendente de cobrança.</p>
          ) : (
            <ul className="grid gap-3">
              {unbilled.map((row) => {
                const rate = row.rate || user.hourlyRateCents;
                return (
                  <li key={row.projectId ?? "sem"} className="flex items-center gap-3 rounded-xl border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{row.projectName ?? "Sem projeto"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {hoursLabel(row.seconds)}
                        {row.clientName ? ` · ${row.clientName}` : ""}
                        {rate ? ` · ${formatMoney(Math.round((row.seconds / 3600) * rate))}` : ""}
                      </p>
                    </div>
                    {row.projectId ? (
                      <ActionButton action={billProjectHours} fields={{ projectId: row.projectId }} size="sm">
                        <ReceiptText /> Faturar
                      </ActionButton>
                    ) : (
                      <span className="text-xs text-muted-foreground">Associe a um projeto</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="mb-4 font-bold">Últimos registros</h2>
          {byDay.size === 0 ? (
            <p className="text-sm text-muted-foreground">Inicie o cronômetro ou lance horas para ver aqui.</p>
          ) : (
            <div className="grid gap-5">
              {[...byDay.entries()].map(([day, rows]) => (
                <div key={day}>
                  <p className="mb-2 flex justify-between text-xs font-semibold text-muted-foreground uppercase">
                    <span>{formatDateLong(day)}</span>
                    <span>{hoursLabel(rows.reduce((s, r) => s + r.entry.durationSeconds, 0))}</span>
                  </p>
                  <ul className="divide-y rounded-xl border">
                    {rows.map(({ entry, projectName, invoiceNumber }) => (
                      <li key={entry.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{entry.description || "Sem descrição"}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {projectName ?? "Sem projeto"}
                            {invoiceNumber ? ` · cobrado na #${String(invoiceNumber).padStart(4, "0")}` : ""}
                          </span>
                        </span>
                        <span className="font-mono text-xs tabular-nums">{hoursLabel(entry.durationSeconds)}</span>
                        {!entry.invoiceId ? (
                          <ConfirmAction
                            action={deleteTimeEntry}
                            fields={{ id: entry.id }}
                            title="Excluir este registro?"
                            confirmLabel="Excluir"
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Excluir registro"
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 />
                              </Button>
                            }
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
