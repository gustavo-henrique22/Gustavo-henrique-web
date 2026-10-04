import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentEditor } from "@/components/recebi/document-editor";
import { PageHeader } from "@/components/recebi/page-header";
import { aiEnabled } from "@/lib/recebi/ai";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { getQuote, listClients, listProjects } from "@/lib/recebi/data";

export const metadata: Metadata = { title: "Editar orçamento" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getQuote(user.id, id);
  if (!data) notFound();
  if (data.quote.status === "aprovado") redirect(`${APP_PATH}/orcamentos/${id}`);
  const [clients, projectRows] = await Promise.all([listClients(user.id, { includeArchived: true }), listProjects(user.id)]);
  const { quote, items } = data;
  const number = String(quote.number).padStart(4, "0");

  return (
    <>
      <Link
        href={`${APP_PATH}/orcamentos/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Orçamento #{number}
      </Link>
      <PageHeader
        title={`Editar orçamento #${number}`}
        description={quote.status === "recusado" ? "Ao salvar, o orçamento volta a aguardar a resposta do cliente." : undefined}
      />
      <DocumentEditor
        kind="quote"
        clients={clients.filter((c) => !c.archived || c.id === quote.clientId).map((c) => ({ id: c.id, name: c.name }))}
        projects={projectRows.map((r) => ({ id: r.project.id, name: r.project.name, clientId: r.project.clientId }))}
        draft={{
          id: quote.id,
          status: quote.status === "recusado" ? "enviado" : quote.status,
          clientId: quote.clientId,
          projectId: quote.projectId,
          issueDate: quote.issueDate,
          dueDate: quote.validUntil,
          paymentTermDays: quote.paymentTermDays,
          discountCents: quote.discountCents,
          notes: quote.notes,
          contract: { text: quote.contractText, pro: hasPro(user) },
          items: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
        }}
        ai={aiEnabled() && quote.status !== "aprovado" ? {} : null}
      />
    </>
  );
}
