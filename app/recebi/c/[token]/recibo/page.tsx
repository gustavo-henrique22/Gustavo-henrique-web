import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/recebi/logo";
import { PrintButton } from "@/components/recebi/print-button";
import { hasPro } from "@/lib/recebi/auth";
import { BASE_PATH } from "@/lib/recebi/config";
import { getPublicInvoice } from "@/lib/recebi/data";
import { formatDateLong } from "@/lib/recebi/dates";
import { moneyToWords } from "@/lib/recebi/extenso";
import { logoUrlFor } from "@/lib/recebi/files";
import { formatMoney } from "@/lib/recebi/money";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await getPublicInvoice(token);
  if (!data || data.invoice.status !== "paga") return { title: "Recibo não encontrado", robots: { index: false } };
  return { title: `Recibo nº ${String(data.invoice.number).padStart(4, "0")}`, robots: { index: false, follow: false } };
}

/** Recibo de pagamento, com valor por extenso, pronto para imprimir ou salvar em PDF. */
export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPublicInvoice(token);
  if (!data || data.invoice.status !== "paga") notFound();
  const { invoice, items, client, owner } = data;
  const ownerName = owner.businessName || owner.name;
  const number = String(invoice.number).padStart(4, "0");
  const logoUrl = logoUrlFor(owner);
  const reference = items.map((item) => item.description).join("; ");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <Link
          href={`${BASE_PATH}/c/${token}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar para a cobrança
        </Link>
        <PrintButton />
      </div>

      <article className="print-flat relative overflow-hidden rounded-2xl border bg-card p-6 text-card-foreground shadow-xs sm:p-12">
        <div aria-hidden className="absolute inset-x-0 top-0 h-2 bg-[repeating-linear-gradient(90deg,#c9ff3c_0_24px,#101c34_24px_48px)]" />
        <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">Recibo</p>
            <h1 className="mt-1 text-4xl font-black tracking-tight">Nº {number}</h1>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo enviada pelo usuário
              <img src={logoUrl} alt={`Logo de ${ownerName}`} className="max-h-12 w-auto max-w-[160px] object-contain" />
            ) : null}
            <div className="rounded-xl bg-[#101c34] px-5 py-3 text-right text-white">
              <p className="text-[0.65rem] font-bold tracking-[0.18em] text-white/60 uppercase">Valor</p>
              <p className="text-2xl font-extrabold text-[#c9ff3c] tabular">{formatMoney(invoice.totalCents)}</p>
            </div>
          </div>
        </header>

        <p className="mt-10 text-lg leading-relaxed">
          Recebi de <strong>{client?.name ?? "—"}</strong>
          {client?.document ? <>, CPF/CNPJ {client.document},</> : null} a importância de{" "}
          <strong>
            {formatMoney(invoice.totalCents)} ({moneyToWords(invoice.totalCents)})
          </strong>
          , referente a <strong>{reference || `cobrança nº ${number}`}</strong>.
        </p>
        <p className="mt-4 text-lg leading-relaxed">Para maior clareza, firmo o presente recibo, dando plena quitação do valor recebido.</p>

        <dl className="mt-8 grid gap-4 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">Data do pagamento</dt>
            <dd className="mt-1 font-bold">{formatDateLong(invoice.paidAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">Forma de pagamento</dt>
            <dd className="mt-1 font-bold">{owner.pixKey ? "Pix" : "Conforme combinado"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">Referência</dt>
            <dd className="mt-1 font-bold">Cobrança nº {number}</dd>
          </div>
        </dl>

        <footer className="mt-14 flex flex-col items-center text-center">
          <p className="text-sm text-muted-foreground">
            {owner.city ? `${owner.city}, ` : ""}
            {formatDateLong(invoice.paidAt)}
          </p>
          <div className="mt-12 w-full max-w-xs border-t border-foreground/40 pt-2">
            <p className="font-bold">{ownerName}</p>
            {owner.businessName && owner.businessName !== owner.name ? <p className="text-sm text-muted-foreground">{owner.name}</p> : null}
            {owner.document ? <p className="text-sm text-muted-foreground">CPF/CNPJ {owner.document}</p> : null}
          </div>
        </footer>
      </article>

      {!hasPro(owner) ? (
        <p className="no-print mt-10 text-center text-xs text-muted-foreground">
          <Link href={BASE_PATH} className="inline-flex items-center gap-1.5 hover:text-foreground">
            Recibo emitido com <Logo className="text-xs" markClassName="size-4" />
          </Link>
        </p>
      ) : null}
    </div>
  );
}
