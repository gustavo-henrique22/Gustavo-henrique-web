import { ArrowLeft, CheckCircle2, Copy, ExternalLink, Pencil, Send, ThumbsDown, Trash2, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/recebi/action-button";
import { ConfirmAction } from "@/components/recebi/confirm-action";
import { QuoteDocument } from "@/components/recebi/document-view";
import { quoteDisplayStatus } from "@/components/recebi/invoice-status";
import { ShareLink } from "@/components/recebi/share-link";
import { DocumentTimeline } from "@/components/recebi/timeline";
import { approveQuoteAsOwner, deleteQuote, duplicateQuote, emailQuote, setQuoteStatus } from "@/lib/recebi/actions/quotes";
import { listEvents } from "@/lib/recebi/activity";
import { requireUser } from "@/lib/recebi/auth";
import { APP_PATH, BASE_PATH } from "@/lib/recebi/config";
import { getQuote } from "@/lib/recebi/data";
import { formatDate } from "@/lib/recebi/dates";
import { emailEnabled } from "@/lib/recebi/email";
import { logoUrlFor } from "@/lib/recebi/files";
import { formatMoney } from "@/lib/recebi/money";
import { siteOrigin } from "@/lib/recebi/origin";
import { whatsappNumber } from "@/lib/recebi/phone";

export const metadata: Metadata = { title: "Orçamento" };

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enviar?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { enviar } = await searchParams;
  const data = await getQuote(user.id, id);
  if (!data) notFound();
  const { quote, client, items, invoiceNumber } = data;
  const events = await listEvents(user.id, quote.id);

  const number = String(quote.number).padStart(4, "0");
  const link = `${await siteOrigin()}${BASE_PATH}/o/${quote.publicToken}`;
  const ownerName = user.businessName || user.name;
  const firstName = client?.name.split(" ")[0] ?? "";
  const message =
    `Olá${firstName ? `, ${firstName}` : ""}! Segue o orçamento #${number} de ${formatMoney(quote.totalCents)}, ` +
    `válido até ${formatDate(quote.validUntil)}. Você pode ver os detalhes e aprovar pelo link: ${link}\n\nQualquer dúvida, estou à disposição! ${ownerName}`;
  const whatsappHref = client?.phone
    ? `https://wa.me/${whatsappNumber(client.phone)}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  const mailHref = client?.email
    ? `mailto:${client.email}?subject=${encodeURIComponent(`Orçamento #${number} — ${ownerName}`)}&body=${encodeURIComponent(message)}`
    : null;
  const display = quoteDisplayStatus(quote.status, quote.validUntil);
  const canEmail = emailEnabled() && !!client?.email;

  return (
    <>
      <Link
        href={`${APP_PATH}/orcamentos`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Orçamentos
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <QuoteDocument quote={quote} items={items} client={client} owner={user} logoUrl={logoUrlFor(user)} className="self-start" />

        <aside className="grid content-start gap-4">
          {quote.status === "rascunho" ? (
            <section className="rounded-2xl border bg-card p-5 shadow-xs">
              <h2 className="font-bold">Rascunho</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O cliente ainda não consegue abrir este orçamento. Libere para gerar o link.
              </p>
              <ActionButton action={setQuoteStatus} fields={{ id: quote.id, status: "enviado" }} className="mt-4 w-full" size="lg">
                <Send /> Liberar e gerar link
              </ActionButton>
            </section>
          ) : null}

          {quote.status === "enviado" ? (
            <ShareLink
              link={link}
              description="O cliente abre o link, confere a proposta e aprova com um clique. A cobrança com Pix é criada na hora."
              whatsappHref={whatsappHref}
              mailHref={mailHref}
              emailAction={canEmail ? { action: emailQuote, fields: { id: quote.id } } : null}
              highlight={enviar === "1"}
            />
          ) : null}

          {quote.status === "enviado" ? (
            <section className="rounded-2xl border bg-card p-5 shadow-xs">
              <h2 className="font-bold">{display === "expirado" ? "Orçamento expirado" : "Aguardando resposta"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {display === "expirado"
                  ? "A validade passou. Edite a data para o cliente poder aprovar de novo."
                  : "O cliente aprovou por WhatsApp ou pessoalmente? Registre a aprovação aqui e a cobrança é criada."}
              </p>
              <ConfirmAction
                action={approveQuoteAsOwner}
                fields={{ id: quote.id }}
                destructive={false}
                title="Registrar aprovação?"
                description={`Vamos marcar o orçamento como aprovado e criar a cobrança de ${formatMoney(quote.totalCents)} com vencimento em ${quote.paymentTermDays} dias.`}
                confirmLabel="Aprovar e criar cobrança"
                trigger={
                  <Button className="mt-4 w-full bg-income text-white hover:bg-income/90" size="lg">
                    <CheckCircle2 /> Cliente aprovou
                  </Button>
                }
              />
            </section>
          ) : null}

          {quote.status === "aprovado" ? (
            <section className="rounded-2xl border border-income/30 bg-income/10 p-5">
              <h2 className="flex items-center gap-2 font-bold text-income">
                <CheckCircle2 className="size-5" /> Aprovado em {formatDate(quote.decidedAt?.slice(0, 10))}
              </h2>
              <p className="mt-1 text-sm">A cobrança foi criada automaticamente com os mesmos itens.</p>
              {quote.invoiceId ? (
                <Button asChild size="sm" className="mt-3">
                  <Link href={`${APP_PATH}/cobrancas/${quote.invoiceId}`}>
                    <ExternalLink /> Ver cobrança #{String(invoiceNumber ?? 0).padStart(4, "0")}
                  </Link>
                </Button>
              ) : null}
            </section>
          ) : null}

          {quote.status === "recusado" ? (
            <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
              <h2 className="flex items-center gap-2 font-bold text-destructive">
                <ThumbsDown className="size-5" /> Recusado em {formatDate(quote.decidedAt?.slice(0, 10))}
              </h2>
              <p className="mt-2 text-sm">
                {quote.decisionNote ? (
                  <>
                    Comentário do cliente: <em>“{quote.decisionNote}”</em>
                  </>
                ) : (
                  "O cliente não deixou comentário."
                )}
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href={`${APP_PATH}/orcamentos/${quote.id}/editar`}>
                  <Pencil /> Ajustar e reenviar
                </Link>
              </Button>
            </section>
          ) : null}

          <DocumentTimeline events={events} viewCount={quote.viewCount} viewedAt={quote.viewedAt} />

          <section className="grid gap-2 rounded-2xl border bg-card p-5 shadow-xs">
            <h2 className="mb-1 font-bold">Mais ações</h2>
            {quote.status !== "aprovado" ? (
              <Button asChild variant="outline" className="justify-start">
                <Link href={`${APP_PATH}/orcamentos/${quote.id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Button>
            ) : null}
            <ActionButton action={duplicateQuote} fields={{ id: quote.id }} variant="outline" className="justify-start">
              <Copy /> Duplicar
            </ActionButton>
            {quote.status === "enviado" ? (
              <ActionButton
                action={setQuoteStatus}
                fields={{ id: quote.id, status: "rascunho" }}
                variant="outline"
                className="justify-start"
              >
                <Undo2 /> Voltar para rascunho
              </ActionButton>
            ) : null}
            <ConfirmAction
              action={deleteQuote}
              fields={{ id: quote.id }}
              title={`Excluir o orçamento #${number}?`}
              description={
                quote.status === "aprovado"
                  ? "O orçamento será apagado, mas a cobrança criada a partir dele continua existindo."
                  : "O orçamento e o link dele deixam de existir. Isso não pode ser desfeito."
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
