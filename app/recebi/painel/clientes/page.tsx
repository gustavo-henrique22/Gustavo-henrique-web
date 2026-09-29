import { Archive, ArchiveRestore, Mail, Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/recebi/action-button";
import { ConfirmAction } from "@/components/recebi/confirm-action";
import { ClientFields } from "@/components/recebi/fields";
import { FormDialog } from "@/components/recebi/form-dialog";
import { PageHeader } from "@/components/recebi/page-header";
import { deleteClient, saveClient, setClientArchived } from "@/lib/recebi/actions/finance";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { APP_PATH, FREE_LIMITS } from "@/lib/recebi/config";
import { clientsWithStats } from "@/lib/recebi/data";
import { formatDate } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { whatsappNumber } from "@/lib/recebi/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ arquivados?: string }> }) {
  const user = await requireUser();
  const showArchived = (await searchParams).arquivados === "1";
  const rows = await clientsWithStats(user.id, showArchived);
  const activeCount = rows.filter((r) => !r.client.archived).length;
  const pro = hasPro(user);

  return (
    <>
      <PageHeader
        title="Clientes"
        description={pro ? `${activeCount} clientes ativos` : `${activeCount} de ${FREE_LIMITS.clients} clientes ativos no plano Grátis`}
        actions={
          <FormDialog
            title="Novo cliente"
            action={saveClient}
            submitLabel="Cadastrar"
            trigger={
              <Button>
                <Plus /> Novo cliente
              </Button>
            }
          >
            <ClientFields />
          </FormDialog>
        }
      />

      <div className="mb-4 flex justify-end">
        <Link
          href={showArchived ? `${APP_PATH}/clientes` : `${APP_PATH}/clientes?arquivados=1`}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {showArchived ? "Esconder arquivados" : "Mostrar arquivados"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted">
            <Users className="size-5 text-muted-foreground" />
          </span>
          <p className="font-semibold">Nenhum cliente ainda</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Cadastre quem contrata você para acompanhar quanto cada um já pagou.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ client, paidCents, openCents, lastPayment }) => (
            <article
              key={client.id}
              className={cn("flex flex-col rounded-2xl border bg-card p-5 shadow-xs", client.archived && "opacity-60")}
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {client.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`${APP_PATH}/clientes/${client.id}`} className="block truncate font-bold hover:underline">
                    {client.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {client.archived
                      ? "Arquivado"
                      : lastPayment
                        ? `Último pagamento em ${formatDate(lastPayment)}`
                        : "Sem pagamentos ainda"}
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/60 p-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Total pago</dt>
                  <dd className="font-bold tabular">{formatMoney(paidCents)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Em aberto</dt>
                  <dd className={cn("font-bold tabular", openCents > 0 && "text-warning")}>{formatMoney(openCents)}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <Mail className="size-3.5" /> {client.email}
                  </a>
                ) : null}
                {client.phone ? (
                  <a
                    href={`https://wa.me/${whatsappNumber(client.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <Phone className="size-3.5" /> {client.phone}
                  </a>
                ) : null}
              </div>
              <div className="mt-auto flex items-center justify-end gap-1 pt-4">
                <Button asChild variant="ghost" size="sm" className="mr-auto">
                  <Link href={`${APP_PATH}/clientes/${client.id}`}>Ver detalhes</Link>
                </Button>
                <FormDialog
                  title="Editar cliente"
                  action={saveClient}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label="Editar" title="Editar">
                      <Pencil />
                    </Button>
                  }
                >
                  <ClientFields client={client} />
                </FormDialog>
                <ActionButton
                  action={setClientArchived}
                  fields={{ id: client.id, archived: client.archived ? "0" : "1" }}
                  variant="ghost"
                  size="icon-sm"
                  aria-label={client.archived ? "Reativar" : "Arquivar"}
                  title={client.archived ? "Reativar" : "Arquivar"}
                >
                  {client.archived ? <ArchiveRestore /> : <Archive />}
                </ActionButton>
                <ConfirmAction
                  action={deleteClient}
                  fields={{ id: client.id }}
                  title={`Excluir ${client.name}?`}
                  description="O cliente será apagado. Os lançamentos e cobranças dele continuam existindo, só ficam sem cliente. Prefira arquivar se só não trabalha mais com ele."
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
          ))}
        </div>
      )}
    </>
  );
}
