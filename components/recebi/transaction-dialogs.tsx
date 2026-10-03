import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Client, Project, Transaction } from "@/db/schema";
import { saveTransaction } from "@/lib/recebi/actions/finance";
import { TransactionFields } from "./fields";
import { FormDialog } from "./form-dialog";

type Options = {
  clients: Pick<Client, "id" | "name">[];
  projects: Pick<Project, "id" | "name" | "status">[];
  attachments?: "enabled" | "locked" | "hidden";
};

export function NewTransactionButton({
  type,
  clients,
  projects,
  defaultClientId,
  size = "default",
  variant,
  label,
  defaultOpen,
  attachments,
}: Options & {
  type: "receita" | "despesa";
  defaultOpen?: boolean;
  defaultClientId?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary";
  label?: string;
}) {
  const isIncome = type === "receita";
  return (
    <FormDialog
      title={isIncome ? "Nova receita" : "Nova despesa"}
      description={isIncome ? "Dinheiro que entrou ou vai entrar." : "Um gasto do seu trabalho."}
      action={saveTransaction}
      submitLabel={isIncome ? "Lançar receita" : "Lançar despesa"}
      defaultOpen={defaultOpen}
      trigger={
        <Button size={size} variant={variant ?? (isIncome ? "default" : "outline")}>
          {isIncome ? <Plus /> : <Minus />}
          {label ?? (isIncome ? "Receita" : "Despesa")}
        </Button>
      }
    >
      <TransactionFields type={type} clients={clients} projects={projects} defaultClientId={defaultClientId} attachments={attachments} />
    </FormDialog>
  );
}

export function EditTransactionDialog({
  transaction,
  trigger,
  clients,
  projects,
  attachments,
}: Options & { transaction: Transaction; trigger: React.ReactNode }) {
  return (
    <FormDialog title={transaction.type === "receita" ? "Editar receita" : "Editar despesa"} action={saveTransaction} trigger={trigger}>
      <TransactionFields
        type={transaction.type}
        transaction={transaction}
        clients={clients}
        projects={projects}
        attachments={attachments}
      />
    </FormDialog>
  );
}
