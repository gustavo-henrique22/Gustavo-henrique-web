import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Client } from "@/db/schema";
import { quickCharge } from "@/lib/recebi/actions/invoices";
import { addDays, todayISO } from "@/lib/recebi/dates";
import { FormField, MoneyInput, Select } from "./fields";
import { FormDialog } from "./form-dialog";

/** Botão "Cobrança rápida": link de Pix em poucos segundos. */
export function QuickChargeButton({
  clients,
  variant = "outline",
  defaultOpen,
}: {
  clients: Pick<Client, "id" | "name">[];
  variant?: "outline" | "default" | "secondary";
  defaultOpen?: boolean;
}) {
  return (
    <FormDialog
      title="Cobrança rápida"
      description="Gere um link com Pix em segundos. Você pode detalhar depois, se quiser."
      action={quickCharge}
      submitLabel="Gerar link de pagamento"
      defaultOpen={defaultOpen}
      trigger={
        <Button variant={variant}>
          <Zap /> Cobrança rápida
        </Button>
      }
    >
      <FormField id="qc-description" label="O que você está cobrando?">
        <Input id="qc-description" name="description" required maxLength={200} placeholder="Ex.: Ajustes no site" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="qc-amount" label="Valor">
          <MoneyInput id="qc-amount" name="amount" required />
        </FormField>
        <FormField id="qc-due" label="Vencimento">
          <Input id="qc-due" name="dueDate" type="date" required defaultValue={addDays(todayISO(), 3)} min={todayISO()} />
        </FormField>
      </div>
      <FormField
        id="qc-client"
        label={
          <>
            Cliente <span className="font-normal text-muted-foreground">(opcional)</span>
          </>
        }
      >
        <Select id="qc-client" name="clientId" defaultValue="">
          <option value="">Sem cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>
    </FormDialog>
  );
}
