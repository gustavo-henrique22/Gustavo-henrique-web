import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentEditor } from "@/components/recebi/document-editor";
import { PageHeader } from "@/components/recebi/page-header";
import { requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { getInvoice, listClients, listProjects } from "@/lib/recebi/data";

export const metadata: Metadata = { title: "Editar cobrança" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getInvoice(user.id, id);
  if (!data) notFound();
  if (data.invoice.status === "paga") redirect(`${APP_PATH}/cobrancas/${id}`);
  const [clients, projectRows] = await Promise.all([listClients(user.id, { includeArchived: true }), listProjects(user.id)]);
  const { invoice, items } = data;

  return (
    <>
      <Link
        href={`${APP_PATH}/cobrancas/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Cobrança #{String(invoice.number).padStart(4, "0")}
      </Link>
      <PageHeader title={`Editar cobrança #${String(invoice.number).padStart(4, "0")}`} />
      <DocumentEditor
        kind="invoice"
        clients={clients.filter((c) => !c.archived || c.id === invoice.clientId).map((c) => ({ id: c.id, name: c.name }))}
        projects={projectRows.map((r) => ({ id: r.project.id, name: r.project.name, clientId: r.project.clientId }))}
        draft={{
          id: invoice.id,
          status: invoice.status,
          clientId: invoice.clientId,
          projectId: invoice.projectId,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          discountCents: invoice.discountCents,
          notes: invoice.notes,
          items: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
        }}
      />
    </>
  );
}
