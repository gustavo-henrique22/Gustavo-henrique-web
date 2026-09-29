import type { Client, Invoice, InvoiceItem, User } from "@/db/schema";
import { formatDate } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";
import { InvoiceStatusBadge } from "./invoice-status";

type Owner = Pick<User, "name" | "businessName" | "email" | "phone" | "document" | "city">;

/** A cobrança como o cliente vê. Usada no painel (prévia) e na página pública. */
export function InvoiceDocument({
  invoice,
  items,
  client,
  owner,
  className,
}: {
  invoice: Invoice;
  items: InvoiceItem[];
  client: Client | null;
  owner: Owner;
  className?: string;
}) {
  const subtotal = items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0);
  const number = String(invoice.number).padStart(4, "0");
  const ownerName = owner.businessName || owner.name;

  return (
    <article className={cn("rounded-2xl border bg-card p-6 text-card-foreground shadow-xs sm:p-10", className)}>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Cobrança</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">#{number}</h1>
          <div className="mt-2">
            <InvoiceStatusBadge status={invoice.status} dueDate={invoice.dueDate} />
          </div>
        </div>
        <div className="text-sm sm:text-right">
          <p className="text-base font-bold">{ownerName}</p>
          {owner.businessName && owner.businessName !== owner.name ? <p className="text-muted-foreground">{owner.name}</p> : null}
          {owner.document ? <p className="text-muted-foreground">CPF/CNPJ {owner.document}</p> : null}
          <p className="text-muted-foreground">{owner.email}</p>
          {owner.phone ? <p className="text-muted-foreground">{owner.phone}</p> : null}
        </div>
      </header>

      <div className="mt-8 grid gap-6 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Para</p>
          <p className="mt-1 font-bold">{client?.name ?? "—"}</p>
          {client?.document ? <p className="text-muted-foreground">{client.document}</p> : null}
          {client?.email ? <p className="break-all text-muted-foreground">{client.email}</p> : null}
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Emissão</p>
          <p className="mt-1 font-bold tabular">{formatDate(invoice.issueDate)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{invoice.status === "paga" ? "Pago em" : "Vencimento"}</p>
          <p className="mt-1 font-bold tabular">{formatDate(invoice.status === "paga" ? invoice.paidAt : invoice.dueDate)}</p>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 font-semibold">Descrição</th>
            <th className="hidden pb-2 text-right font-semibold sm:table-cell">Qtd.</th>
            <th className="hidden pb-2 text-right font-semibold sm:table-cell">Valor</th>
            <th className="pb-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b last:border-0">
              <td className="py-3 pr-4">
                {item.description}
                <span className="block text-xs text-muted-foreground sm:hidden">
                  {item.quantity.toLocaleString("pt-BR")} × {formatMoney(item.unitPriceCents)}
                </span>
              </td>
              <td className="hidden py-3 text-right tabular sm:table-cell">{item.quantity.toLocaleString("pt-BR")}</td>
              <td className="hidden py-3 text-right tabular sm:table-cell">{formatMoney(item.unitPriceCents)}</td>
              <td className="py-3 text-right font-semibold tabular">{formatMoney(Math.round(item.quantity * item.unitPriceCents))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-col-reverse gap-6 sm:flex-row sm:items-end sm:justify-between">
        {invoice.status === "paga" ? (
          <div
            aria-hidden
            className="w-fit -rotate-6 rounded-lg border-[3px] border-double border-income px-4 py-1.5 text-center text-income opacity-90"
          >
            <p className="text-xl font-black tracking-[0.25em]">PAGO</p>
            <p className="text-[0.65rem] font-bold tabular">{formatDate(invoice.paidAt)}</p>
          </div>
        ) : (
          <span />
        )}
        <dl className="grid w-full max-w-xs gap-2 self-end text-sm">
          {invoice.discountCents > 0 ? (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Desconto</dt>
                <dd className="tabular">− {formatMoney(invoice.discountCents)}</dd>
              </div>
            </>
          ) : null}
          <div className="flex items-baseline justify-between border-t pt-3">
            <dt className="font-bold">Total</dt>
            <dd className="text-2xl font-extrabold tabular">{formatMoney(invoice.totalCents)}</dd>
          </div>
        </dl>
      </div>

      {invoice.notes ? (
        <div className="mt-8 border-t pt-4 text-sm whitespace-pre-line text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Observações</p>
          {invoice.notes}
        </div>
      ) : null}
    </article>
  );
}
