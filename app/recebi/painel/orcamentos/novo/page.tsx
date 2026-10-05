import { ArrowLeft, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DocumentEditor } from "@/components/recebi/document-editor";
import { PageHeader } from "@/components/recebi/page-header";
import { aiEnabled } from "@/lib/recebi/ai";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { getQuoteRequest, listClients, listProjects } from "@/lib/recebi/data";
import { addDays, todayISO } from "@/lib/recebi/dates";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ cliente?: string; pedido?: string }> }) {
  const user = await requireUser();
  const { cliente, pedido } = await searchParams;
  const [clients, projectRows, request] = await Promise.all([
    listClients(user.id),
    listProjects(user.id),
    pedido ? getQuoteRequest(user.id, pedido) : null,
  ]);
  const today = todayISO();
  const clientId = request?.request.clientId ?? cliente;
  const service = request?.service;
  const items = service
    ? [{ description: service.name, quantity: 1, unitPriceCents: service.priceType === "consulta" ? 0 : service.priceCents }]
    : [];

  return (
    <>
      <Link
        href={`${APP_PATH}/orcamentos`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Orçamentos
      </Link>
      <PageHeader title="Novo orçamento" description="Monte a proposta, gere o link e deixe o cliente aprovar com um clique." />
      {request ? (
        <aside className="mb-6 flex gap-3 rounded-2xl border border-[#c9ff3c] bg-[#c9ff3c]/15 p-4 text-sm">
          <Inbox className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold">
              Pedido de {request.request.name}
              {service ? ` · ${service.name}` : ""}
            </p>
            <p className="mt-1 whitespace-pre-line text-muted-foreground">“{request.request.message}”</p>
          </div>
        </aside>
      ) : null}
      <DocumentEditor
        kind="quote"
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        projects={projectRows
          .filter((r) => r.project.status !== "concluido")
          .map((r) => ({ id: r.project.id, name: r.project.name, clientId: r.project.clientId }))}
        draft={{
          clientId: clients.some((c) => c.id === clientId) ? clientId : "",
          issueDate: today,
          dueDate: addDays(today, 15),
          paymentTermDays: 7,
          discountCents: 0,
          notes: "",
          contract: { text: user.contractTemplate, pro: hasPro(user) },
          items,
          requestId: request?.request.id,
        }}
        ai={aiEnabled() ? { brief: request?.request.message } : null}
      />
    </>
  );
}
