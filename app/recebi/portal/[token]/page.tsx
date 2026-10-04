import { FileSignature, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceStatusBadge, QuoteStatusBadge } from "@/components/recebi/invoice-status";
import { BASE_PATH } from "@/lib/recebi/config";
import { formatDate } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { getPortal } from "@/lib/recebi/portal";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const data = await getPortal((await params).token);
  const name = data ? data.owner.businessName || data.owner.name : "Portal";
  return { title: `Portal do cliente — ${name}`, robots: { index: false, follow: false } };
}

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const data = await getPortal((await params).token);
  if (!data) notFound();
  const { client, owner, invoices, quotes } = data;
  const ownerName = owner.businessName || owner.name;
  const today = new Date().toISOString().slice(0, 10);
  const open = invoices.filter((i) => i.status === "enviada");
  const openTotal = open.reduce((s, i) => s + i.totalCents, 0);
  const overdue = open.filter((i) => i.dueDate < today).length;
  const paidTotal = invoices.filter((i) => i.status === "paga").reduce((s, i) => s + i.totalCents, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <p className="text-sm text-muted-foreground">Portal do cliente</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {client.name} <span className="font-medium text-muted-foreground">com {ownerName}</span>
      </h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Em aberto</p>
          <p className="mt-1 text-2xl font-extrabold tabular">{formatMoney(openTotal)}</p>
          <p className="text-xs text-muted-foreground">
            {open.length} {open.length === 1 ? "cobrança" : "cobranças"}
            {overdue ? ` · ${overdue} vencida${overdue === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Já pago</p>
          <p className="mt-1 text-2xl font-extrabold text-income tabular">{formatMoney(paidTotal)}</p>
        </div>
      </div>

      <section aria-labelledby="cobrancas" className="mt-6 rounded-2xl border bg-card p-5 shadow-xs">
        <h2 id="cobrancas" className="mb-3 flex items-center gap-2 font-bold">
          <ReceiptText className="size-4" aria-hidden /> Cobranças e recibos
        </h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cobrança ainda.</p>
        ) : (
          <ul className="divide-y">
            {invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">Cobrança #{String(i.number).padStart(4, "0")}</p>
                  <p className="text-xs text-muted-foreground">Vence em {formatDate(i.dueDate)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular">{formatMoney(i.totalCents)}</span>
                  <InvoiceStatusBadge status={i.status} dueDate={i.dueDate} />
                  <Link href={`${BASE_PATH}/c/${i.publicToken}`} className="font-semibold underline underline-offset-4">
                    {i.status === "enviada" ? "Pagar" : "Ver"}
                  </Link>
                  {i.status === "paga" ? (
                    <Link href={`${BASE_PATH}/c/${i.publicToken}/recibo`} className="text-muted-foreground underline underline-offset-4">
                      Recibo
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="orcamentos" className="mt-4 rounded-2xl border bg-card p-5 shadow-xs">
        <h2 id="orcamentos" className="mb-3 flex items-center gap-2 font-bold">
          <FileSignature className="size-4" aria-hidden /> Orçamentos
        </h2>
        {quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum orçamento ainda.</p>
        ) : (
          <ul className="divide-y">
            {quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">Orçamento #{String(q.number).padStart(4, "0")}</p>
                  <p className="text-xs text-muted-foreground">Válido até {formatDate(q.validUntil)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular">{formatMoney(q.totalCents)}</span>
                  <QuoteStatusBadge status={q.status} validUntil={q.validUntil} />
                  <Link href={`${BASE_PATH}/o/${q.publicToken}`} className="font-semibold underline underline-offset-4">
                    {q.status === "enviado" ? "Ver e aprovar" : "Ver"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Link pessoal e privado. Não compartilhe com outras pessoas.
      </p>
    </div>
  );
}
