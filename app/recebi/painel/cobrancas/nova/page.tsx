import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceEditor } from "@/components/recebi/invoice-editor";
import { PageHeader } from "@/components/recebi/page-header";
import { requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { listClients, listProjects } from "@/lib/recebi/data";
import { addDays, todayISO } from "@/lib/recebi/dates";

export const metadata: Metadata = { title: "Nova cobrança" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const user = await requireUser();
  const { cliente } = await searchParams;
  const [clients, projectRows] = await Promise.all([listClients(user.id), listProjects(user.id)]);
  const today = todayISO();

  return (
    <>
      <Link
        href={`${APP_PATH}/cobrancas`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Cobranças
      </Link>
      <PageHeader title="Nova cobrança" description="Monte a cobrança, gere o link e envie para o cliente pagar com Pix." />
      <InvoiceEditor
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        projects={projectRows
          .filter((r) => r.project.status !== "concluido")
          .map((r) => ({ id: r.project.id, name: r.project.name, clientId: r.project.clientId }))}
        draft={{
          clientId: clients.some((c) => c.id === cliente) ? cliente : "",
          issueDate: today,
          dueDate: addDays(today, 7),
          discountCents: 0,
          notes: "",
          items: [],
        }}
      />
    </>
  );
}
