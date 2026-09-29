// Campos de formulário reaproveitados nos diálogos de cadastro/edição.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Client, Project, Transaction } from "@/db/schema";
import { categoriesFor } from "@/lib/recebi/categories";
import { todayISO } from "@/lib/recebi/dates";
import { centsToInput } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

export function FormField({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function MoneyInput({ defaultCents, ...props }: React.ComponentProps<"input"> & { defaultCents?: number }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        className="pl-9 tabular"
        defaultValue={defaultCents !== undefined ? centsToInput(defaultCents) : undefined}
        {...props}
      />
    </div>
  );
}

type ProjectOption = Pick<Project, "id" | "name" | "status">;

export function TransactionFields({
  type,
  clients,
  projects,
  transaction,
  defaultClientId,
}: {
  type: "receita" | "despesa";
  clients: Pick<Client, "id" | "name">[];
  projects: ProjectOption[];
  transaction?: Transaction;
  defaultClientId?: string;
}) {
  const categories = categoriesFor(type);
  const isEdit = !!transaction;
  return (
    <>
      <input type="hidden" name="type" value={type} />
      {transaction ? <input type="hidden" name="id" value={transaction.id} /> : null}
      <FormField id="description" label="Descrição">
        <Input
          id="description"
          name="description"
          required
          maxLength={160}
          defaultValue={transaction?.description}
          placeholder={type === "receita" ? "Ex.: Site institucional — Padaria Sol" : "Ex.: Assinatura do Figma"}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="amount" label="Valor">
          <MoneyInput id="amount" name="amount" required defaultCents={transaction?.amountCents} />
        </FormField>
        <FormField id="date" label={type === "receita" ? "Data do recebimento" : "Data do pagamento"}>
          <Input id="date" name="date" type="date" required defaultValue={transaction?.date ?? todayISO()} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="category" label="Categoria">
          <Select id="category" name="category" required defaultValue={transaction?.category ?? categories[0]}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </FormField>
        <FormField id="status" label="Situação">
          <Select id="status" name="status" defaultValue={transaction?.status ?? "pago"}>
            <option value="pago">{type === "receita" ? "Já recebi" : "Já paguei"}</option>
            <option value="pendente">{type === "receita" ? "A receber" : "A pagar"}</option>
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="clientId"
          label={
            <>
              Cliente <span className="font-normal text-muted-foreground">(opcional)</span>
            </>
          }
        >
          <Select id="clientId" name="clientId" defaultValue={transaction?.clientId ?? defaultClientId ?? ""}>
            <option value="">Nenhum</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          id="projectId"
          label={
            <>
              Projeto <span className="font-normal text-muted-foreground">(opcional)</span>
            </>
          }
        >
          <Select id="projectId" name="projectId" defaultValue={transaction?.projectId ?? ""}>
            <option value="">Nenhum</option>
            {projects
              .filter((p) => p.status !== "concluido" || p.id === transaction?.projectId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </FormField>
      </div>
      {!isEdit ? (
        <FormField id="repeat" label="Repetir" hint="Útil para mensalidades de clientes e assinaturas. Os meses seguintes ficam pendentes.">
          <Select id="repeat" name="repeat" defaultValue="1">
            <option value="1">Não repetir</option>
            {[2, 3, 4, 6, 12].map((n) => (
              <option key={n} value={n}>
                Todo mês, por {n} meses
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
    </>
  );
}

export function ClientFields({ client }: { client?: Client }) {
  return (
    <>
      {client ? <input type="hidden" name="id" value={client.id} /> : null}
      <FormField id="name" label="Nome ou empresa">
        <Input id="name" name="name" required maxLength={120} defaultValue={client?.name} placeholder="Ex.: Padaria Sol" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="email" label="E-mail">
          <Input id="email" name="email" type="email" defaultValue={client?.email} placeholder="contato@cliente.com" />
        </FormField>
        <FormField id="phone" label="Telefone / WhatsApp">
          <Input id="phone" name="phone" type="tel" defaultValue={client?.phone} placeholder="(11) 99999-9999" />
        </FormField>
      </div>
      <FormField
        id="document"
        label={
          <>
            CPF ou CNPJ <span className="font-normal text-muted-foreground">(opcional)</span>
          </>
        }
      >
        <Input id="document" name="document" defaultValue={client?.document} />
      </FormField>
      <FormField
        id="notes"
        label={
          <>
            Observações <span className="font-normal text-muted-foreground">(opcional)</span>
          </>
        }
      >
        <Textarea id="notes" name="notes" rows={3} defaultValue={client?.notes} />
      </FormField>
    </>
  );
}

export function ProjectFields({ project, clients }: { project?: Project; clients: Pick<Client, "id" | "name">[] }) {
  return (
    <>
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <FormField id="name" label="Nome do projeto">
        <Input id="name" name="name" required maxLength={120} defaultValue={project?.name} placeholder="Ex.: Identidade visual" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="clientId" label="Cliente">
          <Select id="clientId" name="clientId" defaultValue={project?.clientId ?? ""}>
            <option value="">Sem cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="status" label="Status">
          <Select id="status" name="status" defaultValue={project?.status ?? "ativo"}>
            <option value="ativo">Em andamento</option>
            <option value="pausado">Pausado</option>
            <option value="concluido">Concluído</option>
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="budget" label="Valor combinado">
          <MoneyInput id="budget" name="budget" defaultCents={project?.budgetCents || undefined} />
        </FormField>
        <FormField id="dueDate" label="Prazo de entrega">
          <Input id="dueDate" name="dueDate" type="date" defaultValue={project?.dueDate ?? ""} />
        </FormField>
      </div>
      <FormField
        id="notes"
        label={
          <>
            Observações <span className="font-normal text-muted-foreground">(opcional)</span>
          </>
        }
      >
        <Textarea id="notes" name="notes" rows={3} defaultValue={project?.notes} />
      </FormField>
    </>
  );
}
