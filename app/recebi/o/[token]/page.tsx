import { CheckCircle2, Clock, ThumbsDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { QuoteDocument } from "@/components/recebi/document-view";
import { Logo } from "@/components/recebi/logo";
import { PrintButton } from "@/components/recebi/print-button";
import { QuoteDecision } from "@/components/recebi/quote-decision";
import { recordView } from "@/lib/recebi/activity";
import { getAccount, hasPro } from "@/lib/recebi/auth";
import { BASE_PATH } from "@/lib/recebi/config";
import { getPublicQuote } from "@/lib/recebi/data";
import { formatDate, todayISO } from "@/lib/recebi/dates";
import { logoUrlFor } from "@/lib/recebi/files";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await getPublicQuote(token);
  if (!data) return { title: "Orçamento não encontrado", robots: { index: false } };
  const name = data.owner.businessName || data.owner.name;
  return { title: `Orçamento #${String(data.quote.number).padStart(4, "0")} — ${name}`, robots: { index: false, follow: false } };
}

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPublicQuote(token);
  if (!data) notFound();
  const { quote, items, client, owner, invoiceToken } = data;
  await recordView("orcamento", quote, (await getAccount())?.id ?? null, client?.name ?? null);
  const ownerName = owner.businessName || owner.name;
  const expired = quote.status === "enviado" && quote.validUntil < todayISO();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Orçamento enviado por <strong className="text-foreground">{ownerName}</strong>
        </p>
        <PrintButton />
      </div>

      {quote.status === "aprovado" ? (
        <div className="no-print mb-4 flex flex-col gap-3 rounded-xl border border-income/30 bg-income/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 font-semibold text-income">
            <CheckCircle2 className="size-5" /> Orçamento aprovado em {formatDate(quote.decidedAt?.slice(0, 10))}.
          </p>
          {invoiceToken ? (
            <Button asChild size="sm">
              <Link href={`${BASE_PATH}/c/${invoiceToken}`}>Ver cobrança e pagar</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      {quote.status === "recusado" ? (
        <p className="no-print mb-4 flex items-center gap-2 rounded-xl border bg-muted px-4 py-3 text-sm font-semibold">
          <ThumbsDown className="size-5" /> Orçamento recusado. {ownerName} já recebeu a resposta. Obrigado pelo retorno!
        </p>
      ) : null}
      {expired ? (
        <p className="no-print mb-4 flex items-center gap-2 rounded-xl border bg-muted px-4 py-3 text-sm font-semibold">
          <Clock className="size-5" /> Este orçamento venceu em {formatDate(quote.validUntil)}. Peça uma versão atualizada para {ownerName}.
        </p>
      ) : null}

      <QuoteDocument quote={quote} items={items} client={client} owner={owner} logoUrl={logoUrlFor(owner)} className="print-flat" />

      {quote.status === "enviado" && !expired ? (
        <div className="no-print mt-6">
          <QuoteDecision token={token} totalCents={quote.totalCents} ownerName={ownerName} />
        </div>
      ) : null}

      {!hasPro(owner) ? (
        <p className="no-print mt-10 text-center text-xs text-muted-foreground">
          <Link href={BASE_PATH} className="inline-flex items-center gap-1.5 hover:text-foreground">
            Orçamento criado com <Logo className="text-xs" markClassName="size-4" /> — controle financeiro para freelancers
          </Link>
        </p>
      ) : null}
    </div>
  );
}
