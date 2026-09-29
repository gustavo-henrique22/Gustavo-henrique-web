import { ArrowLeft, Ban, CheckCircle2, Copy, Pencil, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/recebi/action-button";
import { ConfirmAction } from "@/components/recebi/confirm-action";
import { FormField, Select } from "@/components/recebi/fields";
import { FormDialog } from "@/components/recebi/form-dialog";
import { InvoiceDocument } from "@/components/recebi/invoice-document";
import { invoiceDisplayStatus } from "@/components/recebi/invoice-status";
import { ShareInvoice } from "@/components/recebi/share-invoice";
import { deleteInvoice, duplicateInvoice, markInvoicePaid, setInvoiceStatus, undoInvoicePayment } from "@/lib/recebi/actions/invoices";
import { requireUser } from "@/lib/recebi/auth";
import { INCOME_CATEGORIES } from "@/lib/recebi/categories";
import { APP_PATH, BASE_PATH } from "@/lib/recebi/config";
import { getInvoice } from "@/lib/recebi/data";
import { formatDate, todayISO } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { siteOrigin } from "@/lib/recebi/origin";
import { whatsappNumber } from "@/lib/recebi/phone";

export const metadata: Metadata = { title: "Cobrança" };

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enviar?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { enviar } = await searchParams;
  const data = await getInvoice(user.id, id);
  if (!data) notFound();
  const { invoice, client, items } = data;

  const number = String(invoice.number).padStart(4, "0");
  const link = `${await siteOrigin()}${BASE_PATH}/c/${invoice.publicToken}`;
  const ownerName = user.businessName || user.name;
  const firstName = client?.name.split(" ")[0] ?? "";
  const message =
    `Olá${firstName ? `, ${firstName}` : ""}! Segue a cobrança #${number} de ${formatMoney(invoice.totalCents)}, ` +
    `com vencimento em ${formatDate(invoice.dueDate)}. Você pode pagar por Pix pelo link: ${link}\n\nObrigado! ${ownerName}`;
  const whatsappHref = client?.phone
    ? `https://wa.me/${whatsappNumber(client.phone)}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  const mailHref = client?.email
    ? `mailto:${client.email}?subject=${encodeURIComponent(`Cobrança #${number} — ${ownerName}`)}&body=${encodeURIComponent(message)}`
    : null;
  const display = invoiceDisplayStatus(invoice.status, invoice.dueDate);

  return (
    <>
      <Link
        href={`${APP_PATH}/cobrancas`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Cobranças
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <InvoiceDocument invoice={invoice} items={items} client={client} owner={user} />

        <aside className="grid content-start gap-4">
          {invoice.status === "rascunho" ? (
            <section className="rounded-2xl border bg-card p-5 shadow-xs">
              <h2 className="font-bold">Rascunho</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O cliente ainda não consegue abrir esta cobrança. Libere para gerar o link.
              </p>
              <ActionButton action={setInvoiceStatus} fields={{ id: invoice.id, status: "enviada" }} className="mt-4 w-full" size="lg">
                <Send /> Liberar e gerar link
              </ActionButton>
            </section>
          ) : null}

          {invoice.status === "enviada" || invoice.status === "paga" ? (
            <ShareInvoice
              link={link}
              whatsappHref={whatsappHref}
              mailHref={mailHref}
              highlight={enviar === "1" && invoice.status === "enviada"}
            />
          ) : null}

          {invoice.status === "enviada" ? (
            <section className="rounded-2xl border bg-card p-5 shadow-xs">
              <h2 className="font-bold">{display === "vencida" ? "Cobrança vencida" : "Aguardando pagamento"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Quando o dinheiro cair na sua conta, marque como paga. A receita entra automaticamente nos lançamentos.
              </p>
              <FormDialog
                title={`Registrar pagamento da #${number}`}
                description={`Valor: ${formatMoney(invoice.totalCents)}`}
                action={markInvoicePaid}
                submitLabel="Confirmar pagamento"
                trigger={
                  <Button className="mt-4 w-full bg-income text-white hover:bg-income/90" size="lg">
                    <CheckCircle2 /> Marcar como paga
                  </Button>
                }
              >
                <input type="hidden" name="id" value={invoice.id} />
                <FormField id="paidAt" label="Data do pagamento">
                  <Input id="paidAt" name="paidAt" type="date" required defaultValue={todayISO()} />
                </FormField>
                <FormField id="category" label="Categoria da receita">
                  <Select id="category" name="category" defaultValue={invoice.projectId ? "Projeto" : INCOME_CATEGORIES[0]}>
                    {INCOME_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </FormField>
              </FormDialog>
            </section>
          ) : null}

          {invoice.status === "paga" ? (
            <section className="rounded-2xl border border-income/30 bg-income/10 p-5">
              <h2 className="flex items-center gap-2 font-bold text-income">
                <CheckCircle2 className="size-5" /> Paga em {formatDate(invoice.paidAt)}
              </h2>
              <p className="mt-1 text-sm">A receita de {formatMoney(invoice.totalCents)} já está nos seus lançamentos.</p>
              <ConfirmAction
                action={undoInvoicePayment}
                fields={{ id: invoice.id }}
                title="Desfazer pagamento?"
                description="A cobrança volta a ficar em aberto e a receita criada automaticamente será removida dos lançamentos."
                confirmLabel="Desfazer"
                trigger={
                  <Button variant="outline" size="sm" className="mt-3">
                    <Undo2 /> Desfazer pagamento
                  </Button>
                }
              />
            </section>
          ) : null}

          {invoice.status === "cancelada" ? (
            <section className="rounded-2xl border bg-card p-5 shadow-xs">
              <h2 className="font-bold">Cobrança cancelada</h2>
              <p className="mt-1 text-sm text-muted-foreground">O link mostra ao cliente que ela foi cancelada.</p>
              <ActionButton action={setInvoiceStatus} fields={{ id: invoice.id, status: "enviada" }} variant="outline" className="mt-3">
                <RotateCcw /> Reativar
              </ActionButton>
            </section>
          ) : null}

          <section className="grid gap-2 rounded-2xl border bg-card p-5 shadow-xs">
            <h2 className="mb-1 font-bold">Mais ações</h2>
            {invoice.status !== "paga" ? (
              <Button asChild variant="outline" className="justify-start">
                <Link href={`${APP_PATH}/cobrancas/${invoice.id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Button>
            ) : null}
            <ActionButton action={duplicateInvoice} fields={{ id: invoice.id }} variant="outline" className="justify-start">
              <Copy /> Duplicar
            </ActionButton>
            {invoice.status === "enviada" ? (
              <ConfirmAction
                action={setInvoiceStatus}
                fields={{ id: invoice.id, status: "cancelada" }}
                title="Cancelar cobrança?"
                description="O cliente verá que a cobrança foi cancelada ao abrir o link."
                confirmLabel="Cancelar cobrança"
                trigger={
                  <Button variant="outline" className="justify-start">
                    <Ban /> Cancelar cobrança
                  </Button>
                }
              />
            ) : null}
            <ConfirmAction
              action={deleteInvoice}
              fields={{ id: invoice.id }}
              title={`Excluir a cobrança #${number}?`}
              description={
                invoice.status === "paga"
                  ? "A cobrança será apagada, mas a receita já lançada continua nos seus lançamentos."
                  : "A cobrança e o link dela deixam de existir. Isso não pode ser desfeito."
              }
              confirmLabel="Excluir"
              trigger={
                <Button variant="outline" className="justify-start text-destructive hover:text-destructive">
                  <Trash2 /> Excluir
                </Button>
              }
            />
          </section>
        </aside>
      </div>
    </>
  );
}
