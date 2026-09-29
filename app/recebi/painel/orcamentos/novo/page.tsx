import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DocumentEditor } from "@/components/recebi/document-editor";
import { PageHeader } from "@/components/recebi/page-header";
import { requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { listClients, listProjects } from "@/lib/recebi/data";
import { addDays, todayISO } from "@/lib/recebi/dates";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const user = await requireUser();
  const { cliente } = await searchParams;
  const [clients, projectRows] = await Promise.all([listClients(user.id), listProjects(user.id)]);
  const today = todayISO();

  return (
    <>
      <Link
        href={`${APP_PATH}/orcamentos`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Orçamentos
      </Link>
      <PageHeader title="Novo orçamento" description="Monte a proposta, gere o link e deixe o cliente aprovar com um clique." />
      <DocumentEditor
        kind="quote"
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        projects={projectRows
          .filter((r) => r.project.status !== "concluido")
          .map((r) => ({ id: r.project.id, name: r.project.name, clientId: r.project.clientId }))}
        draft={{
          clientId: clients.some((c) => c.id === cliente) ? cliente : "",
          issueDate: today,
          dueDate: addDays(today, 15),
          paymentTermDays: 7,
          discountCents: 0,
          notes: "",
          items: [],
        }}
      />
    </>
  );
}
