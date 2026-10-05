import { Ban, CheckCircle2, FileCheck2, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/recebi/document-view";
import { Logo } from "@/components/recebi/logo";
import { PixBox } from "@/components/recebi/pix-box";
import { PrintButton } from "@/components/recebi/print-button";
import { recordView } from "@/lib/recebi/activity";
import { getAccount, hasPro } from "@/lib/recebi/auth";
import { BASE_PATH } from "@/lib/recebi/config";
import { getPublicInvoice } from "@/lib/recebi/data";
import { formatDate } from "@/lib/recebi/dates";
import { logoUrlFor } from "@/lib/recebi/files";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await getPublicInvoice(token);
  if (!data) return { title: "Cobrança não encontrada", robots: { index: false } };
  const name = data.owner.businessName || data.owner.name;
  return {
    title: `Cobrança #${String(data.invoice.number).padStart(4, "0")} — ${name}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ aprovado?: string }>;
}) {
  const { token } = await params;
  const { aprovado } = await searchParams;
  const data = await getPublicInvoice(token);
  if (!data) notFound();
  const { invoice, items, client, owner } = data;
  await recordView("cobranca", invoice, (await getAccount())?.id ?? null, client?.name ?? null);
  const ownerName = owner.businessName || owner.name;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Cobrança enviada por <strong className="text-foreground">{ownerName}</strong>
        </p>
        <PrintButton />
      </div>

      {aprovado === "1" && invoice.status === "enviada" ? (
        <div className="no-print mb-4 rounded-xl border-2 border-income/40 bg-income/10 px-4 py-4">
          <p className="flex items-center gap-2 font-bold text-income">
            <PartyPopper className="size-5" /> Orçamento aprovado! Obrigado pela confiança.
          </p>
          <p className="mt-1 text-sm">{ownerName} já foi avisado. Abaixo está a cobrança para pagamento com Pix.</p>
        </div>
      ) : null}
      {invoice.status === "paga" ? (
        <div className="no-print mb-4 flex flex-col gap-3 rounded-xl border border-income/30 bg-income/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 font-semibold text-income">
            <CheckCircle2 className="size-5" /> Pagamento confirmado em {formatDate(invoice.paidAt)}. Obrigado!
          </p>
          <Button asChild size="sm">
            <Link href={`${BASE_PATH}/c/${token}/recibo`}>
              <FileCheck2 /> Ver recibo
            </Link>
          </Button>
        </div>
      ) : null}
      {invoice.status === "cancelada" ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl border bg-muted px-4 py-3 text-sm font-semibold">
          <Ban className="size-5" /> Esta cobrança foi cancelada. Não é necessário pagar.
        </p>
      ) : null}

      <InvoiceDocument invoice={invoice} items={items} client={client} owner={owner} logoUrl={logoUrlFor(owner)} className="print-flat" />

      {invoice.status === "enviada" ? (
        <div className="mt-6">
          {owner.pixKey ? (
            <PixBox
              pixKey={owner.pixKey}
              name={ownerName}
              city={owner.city}
              amountCents={invoice.totalCents}
              reference={`COB${String(invoice.number).padStart(4, "0")}`}
            />
          ) : (
            <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              Combine a forma de pagamento diretamente com {ownerName}
              {owner.phone ? ` pelo telefone ${owner.phone}` : ""} ou pelo e-mail {owner.email}.
            </p>
          )}
        </div>
      ) : null}

      {!hasPro(owner) ? (
        <p className="no-print mt-10 text-center text-xs text-muted-foreground">
          <Link href={BASE_PATH} className="inline-flex items-center gap-1.5 hover:text-foreground">
            Cobrança criada com <Logo className="text-xs" markClassName="size-4" /> — controle financeiro para freelancers
          </Link>
        </p>
      ) : null}
    </div>
  );
}
