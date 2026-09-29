import type { Client, Invoice, InvoiceItem, Quote, QuoteItem, User } from "@/db/schema";
import { ShieldCheck } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";
import { InvoiceStatusBadge, QuoteStatusBadge } from "./invoice-status";

type Owner = Pick<User, "name" | "businessName" | "email" | "phone" | "document" | "city">;
type Item = Pick<InvoiceItem | QuoteItem, "id" | "description" | "quantity" | "unitPriceCents">;

type ViewProps = {
  label: string;
  number: number;
  badge: React.ReactNode;
  dates: { label: string; value: string | null }[];
  items: Item[];
  discountCents: number;
  totalCents: number;
  notes: string;
  notesLabel: string;
  stamp?: { label: string; date: string | null };
  /** Texto do aceite eletrônico (orçamentos aprovados pelo cliente). */
  acceptance?: string | null;
  client: Client | null;
  owner: Owner;
  logoUrl?: string | null;
  className?: string;
};

/** Documento (cobrança ou orçamento) como o cliente vê. Usado no painel e nas páginas públicas. */
function DocumentView({
  label,
  number,
  badge,
  dates,
  items,
  discountCents,
  totalCents,
  notes,
  notesLabel,
  stamp,
  acceptance,
  client,
  owner,
  logoUrl,
  className,
}: ViewProps) {
  const subtotal = items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0);
  const ownerName = owner.businessName || owner.name;

  return (
    <article className={cn("rounded-2xl border bg-card p-6 text-card-foreground shadow-xs sm:p-10", className)}>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">#{String(number).padStart(4, "0")}</h1>
          <div className="mt-2">{badge}</div>
        </div>
        <div className="flex flex-col gap-3 text-sm sm:items-end sm:text-right">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo enviada pelo usuário, servida pelo próprio app
            <img src={logoUrl} alt={`Logo de ${ownerName}`} className="max-h-14 w-auto max-w-[180px] object-contain" />
          ) : null}
          <div>
            <p className="text-base font-bold">{ownerName}</p>
            {owner.businessName && owner.businessName !== owner.name ? <p className="text-muted-foreground">{owner.name}</p> : null}
            {owner.document ? <p className="text-muted-foreground">CPF/CNPJ {owner.document}</p> : null}
            <p className="text-muted-foreground">{owner.email}</p>
            {owner.phone ? <p className="text-muted-foreground">{owner.phone}</p> : null}
          </div>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-4 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-3 sm:gap-6">
        <div className="col-span-2 sm:col-span-1">
          <p className="text-xs font-semibold text-muted-foreground">Para</p>
          <p className="mt-1 font-bold">{client?.name ?? "—"}</p>
          {client?.document ? <p className="text-muted-foreground">{client.document}</p> : null}
          {client?.email ? <p className="break-all text-muted-foreground">{client.email}</p> : null}
        </div>
        {dates.map((date) => (
          <div key={date.label}>
            <p className="text-xs font-semibold text-muted-foreground">{date.label}</p>
            <p className="mt-1 font-bold tabular">{formatDate(date.value)}</p>
          </div>
        ))}
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

      <div className="mt-4 flex flex-col-reverse gap-6 sm:flex-row sm:items-end">
        {stamp ? (
          <div
            aria-hidden
            className="w-fit -rotate-6 rounded-lg border-[3px] border-double border-income px-4 py-1.5 text-center text-income opacity-90"
          >
            <p className="text-xl font-black tracking-[0.25em]">{stamp.label}</p>
            <p className="text-[0.65rem] font-bold tabular">{formatDate(stamp.date)}</p>
          </div>
        ) : null}
        <dl className="ml-auto grid w-full max-w-xs gap-2 text-sm">
          {discountCents > 0 ? (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Desconto</dt>
                <dd className="tabular">− {formatMoney(discountCents)}</dd>
              </div>
            </>
          ) : null}
          <div className="flex items-baseline justify-between border-t pt-3">
            <dt className="font-bold">Total</dt>
            <dd className="text-2xl font-extrabold tabular">{formatMoney(totalCents)}</dd>
          </div>
        </dl>
      </div>

      {acceptance ? (
        <p className="mt-6 flex items-start gap-2 rounded-xl border border-income/30 bg-income/5 px-4 py-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-income" aria-hidden />
          <span>{acceptance}</span>
        </p>
      ) : null}

      {notes ? (
        <div className="mt-8 border-t pt-4 text-sm whitespace-pre-line text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">{notesLabel}</p>
          {notes}
        </div>
      ) : null}
    </article>
  );
}

type Common = { client: Client | null; owner: Owner; logoUrl?: string | null; className?: string };

export function InvoiceDocument({ invoice, items, ...rest }: Common & { invoice: Invoice; items: Item[] }) {
  const paid = invoice.status === "paga";
  return (
    <DocumentView
      {...rest}
      label="Cobrança"
      number={invoice.number}
      badge={<InvoiceStatusBadge status={invoice.status} dueDate={invoice.dueDate} />}
      dates={[
        { label: "Emissão", value: invoice.issueDate },
        { label: paid ? "Pago em" : "Vencimento", value: paid ? invoice.paidAt : invoice.dueDate },
      ]}
      items={items}
      discountCents={invoice.discountCents}
      totalCents={invoice.totalCents}
      notes={invoice.notes}
      notesLabel="Observações"
      stamp={paid ? { label: "PAGO", date: invoice.paidAt } : undefined}
    />
  );
}

export function QuoteDocument({ quote, items, ...rest }: Common & { quote: Quote; items: Item[] }) {
  return (
    <DocumentView
      {...rest}
      label="Orçamento"
      number={quote.number}
      badge={<QuoteStatusBadge status={quote.status} validUntil={quote.validUntil} />}
      dates={[
        { label: "Emissão", value: quote.issueDate },
        { label: "Válido até", value: quote.validUntil },
      ]}
      items={items}
      discountCents={quote.discountCents}
      totalCents={quote.totalCents}
      notes={quote.notes}
      notesLabel="Condições e observações"
      stamp={quote.status === "aprovado" ? { label: "APROVADO", date: quote.decidedAt?.slice(0, 10) ?? null } : undefined}
      acceptance={
        quote.status === "aprovado" && quote.acceptedName && quote.decidedAt
          ? `Aprovado eletronicamente por ${quote.acceptedName} em ${formatDateTime(quote.decidedAt)} (horário de Brasília)${quote.acceptedIp ? `, a partir do endereço ${quote.acceptedIp}` : ""}.`
          : null
      }
    />
  );
}
