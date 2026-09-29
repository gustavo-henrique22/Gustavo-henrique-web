import { Input } from "@/components/ui/input";
import type { RecurringInvoice } from "@/db/schema";
import { saveRecurring } from "@/lib/recebi/actions/recurring";
import { addDays, firstMonthlyDate, todayISO } from "@/lib/recebi/dates";
import { FormField, MoneyInput, Select } from "./fields";
import { FormDialog } from "./form-dialog";

type Option = { id: string; name: string };

/** Diálogo para criar ou editar uma cobrança recorrente. */
export function RecurringDialog({
  trigger,
  clients,
  projects,
  recurring,
  preset,
  defaultOpen,
}: {
  trigger: React.ReactNode;
  clients: Option[];
  projects: Option[];
  recurring?: RecurringInvoice;
  /** Valores iniciais (ex.: "Repetir todo mês" a partir de uma cobrança). */
  preset?: { clientId?: string | null; projectId?: string | null; description?: string; amountCents?: number; dayOfMonth?: number };
  defaultOpen?: boolean;
}) {
  const today = todayISO();
  const values = recurring ?? preset ?? {};
  const day = values.dayOfMonth ?? Number(today.slice(8, 10));
  return (
    <FormDialog
      title={recurring ? "Editar cobrança recorrente" : "Nova cobrança recorrente"}
      description="Todo mês o Recebi gera a cobrança com Pix e, se você quiser, envia por e-mail para o cliente."
      action={saveRecurring}
      submitLabel={recurring ? "Salvar" : "Criar recorrência"}
      trigger={trigger}
      defaultOpen={defaultOpen}
    >
      {recurring ? <input type="hidden" name="id" value={recurring.id} /> : null}
      <FormField id="rec-client" label="Cliente">
        <Select id="rec-client" name="clientId" required defaultValue={values.clientId ?? ""}>
          <option value="" disabled>
            Escolha o cliente
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField id="rec-description" label="O que é cobrado todo mês">
        <Input
          id="rec-description"
          name="description"
          required
          maxLength={200}
          defaultValue={values.description ?? ""}
          placeholder="Ex.: Gestão de redes sociais"
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="rec-amount" label="Valor mensal">
          <MoneyInput id="rec-amount" name="amount" required defaultCents={values.amountCents || undefined} />
        </FormField>
        <FormField id="rec-day" label="Gerar todo dia">
          <Input id="rec-day" name="dayOfMonth" type="number" min={1} max={31} required defaultValue={day} />
        </FormField>
        <FormField id="rec-due" label="Prazo (dias)" hint="Para pagar após gerar.">
          <Input id="rec-due" name="dueDays" type="number" min={0} max={60} required defaultValue={recurring?.dueDays ?? 5} />
        </FormField>
      </div>
      {!recurring ? (
        <FormField id="rec-first" label="Primeira cobrança em" hint="Se for hoje, a cobrança é gerada na hora.">
          <Input
            id="rec-first"
            name="firstDate"
            type="date"
            min={today}
            max={addDays(today, 400)}
            defaultValue={firstMonthlyDate(today, day)}
          />
        </FormField>
      ) : null}
      {projects.length > 0 ? (
        <FormField
          id="rec-project"
          label={
            <>
              Projeto <span className="font-normal text-muted-foreground">(opcional)</span>
            </>
          }
        >
          <Select id="rec-project" name="projectId" defaultValue={values.projectId ?? ""}>
            <option value="">Nenhum</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="autoSend"
          defaultChecked={recurring?.autoSend ?? true}
          className="mt-0.5 size-4 accent-[var(--primary)]"
        />
        <span>
          <span className="font-medium">Enviar automaticamente para o cliente</span>
          <span className="block text-xs text-muted-foreground">
            Por e-mail, se o cliente tiver e-mail cadastrado. Desmarcado, a cobrança fica em rascunho para você revisar.
          </span>
        </span>
      </label>
    </FormDialog>
  );
}
