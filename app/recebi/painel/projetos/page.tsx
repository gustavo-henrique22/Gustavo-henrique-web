import { CalendarDays, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmAction } from "@/components/recebi/confirm-action";
import { ProjectFields } from "@/components/recebi/fields";
import { FormDialog } from "@/components/recebi/form-dialog";
import { PageHeader } from "@/components/recebi/page-header";
import { getDb } from "@/db";
import { transactions } from "@/db/schema";
import { deleteProject, saveProject } from "@/lib/recebi/actions/finance";
import { requireUser } from "@/lib/recebi/auth";
import { listClients, listProjects } from "@/lib/recebi/data";
import { daysBetween, formatDate, todayISO } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projetos" };

const STATUS = {
  ativo: { label: "Em andamento", className: "border-income/30 bg-income/10 text-income" },
  pausado: { label: "Pausado", className: "border-warning/30 bg-warning/10 text-warning" },
  concluido: { label: "Concluído", className: "text-muted-foreground" },
} as const;

export default async function ProjectsPage() {
  const user = await requireUser();
  const [rows, clients, received] = await Promise.all([
    listProjects(user.id),
    listClients(user.id),
    getDb()
      .select({
        projectId: transactions.projectId,
        income: sql<number>`coalesce(sum(case when ${transactions.type} = 'receita' and ${transactions.status} = 'pago' then ${transactions.amountCents} else 0 end), 0)`,
        expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'despesa' and ${transactions.status} = 'pago' then ${transactions.amountCents} else 0 end), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), isNotNull(transactions.projectId)))
      .groupBy(transactions.projectId),
  ]);
  const today = todayISO();

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Acompanhe quanto cada trabalho já rendeu e o que falta receber."
        actions={
          <FormDialog
            title="Novo projeto"
            action={saveProject}
            submitLabel="Criar projeto"
            trigger={
              <Button>
                <Plus /> Novo projeto
              </Button>
            }
          >
            <ProjectFields clients={clients} />
          </FormDialog>
        }
      />

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted">
            <FolderKanban className="size-5 text-muted-foreground" />
          </span>
          <p className="font-semibold">Nenhum projeto ainda</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crie um projeto, associe as receitas e despesas dele e veja o lucro real de cada trabalho.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(({ project, clientName }) => {
            const totals = received.find((r) => r.projectId === project.id);
            const income = totals?.income ?? 0;
            const expense = totals?.expense ?? 0;
            const percent = project.budgetCents > 0 ? Math.min(100, Math.round((income / project.budgetCents) * 100)) : null;
            const daysLeft = project.dueDate ? daysBetween(today, project.dueDate) : null;
            const status = STATUS[project.status];
            return (
              <article key={project.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold">{project.name}</h2>
                    <p className="truncate text-xs text-muted-foreground">{clientName ?? "Sem cliente"}</p>
                  </div>
                  <Badge variant="outline" className={status.className}>
                    {status.label}
                  </Badge>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Combinado</dt>
                    <dd className="font-bold tabular">{formatMoney(project.budgetCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Recebido</dt>
                    <dd className="font-bold text-income tabular">{formatMoney(income)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Lucro</dt>
                    <dd className="font-bold tabular">{formatMoney(income - expense)}</dd>
                  </div>
                </dl>

                {percent !== null ? (
                  <div className="mt-4">
                    <Progress
                      value={percent}
                      className="h-2 bg-muted [&>div]:bg-income"
                      aria-label="Quanto do valor combinado já foi recebido"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {percent}% recebido
                      {project.budgetCents > income ? ` · faltam ${formatMoney(project.budgetCents - income)}` : ""}
                    </p>
                  </div>
                ) : null}

                <div className="mt-auto flex items-center gap-1 pt-4">
                  {project.dueDate ? (
                    <span
                      className={cn(
                        "mr-auto inline-flex items-center gap-1 text-xs text-muted-foreground",
                        project.status !== "concluido" && daysLeft !== null && daysLeft < 0 && "font-semibold text-destructive",
                      )}
                    >
                      <CalendarDays className="size-3.5" /> Entrega {formatDate(project.dueDate)}
                      {project.status !== "concluido" && daysLeft !== null
                        ? daysLeft < 0
                          ? ` (atrasado ${-daysLeft}d)`
                          : daysLeft === 0
                            ? " (hoje)"
                            : ` (em ${daysLeft}d)`
                        : ""}
                    </span>
                  ) : (
                    <span className="mr-auto text-xs text-muted-foreground">Sem prazo</span>
                  )}
                  <FormDialog
                    title="Editar projeto"
                    action={saveProject}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Editar" title="Editar">
                        <Pencil />
                      </Button>
                    }
                  >
                    <ProjectFields project={project} clients={clients} />
                  </FormDialog>
                  <ConfirmAction
                    action={deleteProject}
                    fields={{ id: project.id }}
                    title={`Excluir "${project.name}"?`}
                    description="Os lançamentos associados continuam existindo, só ficam sem projeto."
                    confirmLabel="Excluir"
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Excluir"
                        title="Excluir"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    }
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
