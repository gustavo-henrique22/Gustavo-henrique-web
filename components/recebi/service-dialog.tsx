import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Service } from "@/db/schema";
import { saveService } from "@/lib/recebi/actions/public-page";
import { PRICE_TYPE_LABELS } from "@/lib/recebi/public-profile";
import { FormField, MoneyInput, Select } from "./fields";
import { FormDialog } from "./form-dialog";

/** Criar ou editar um serviço da página pública. */
export function ServiceDialog({ trigger, service }: { trigger: React.ReactNode; service?: Service }) {
  return (
    <FormDialog
      title={service ? "Editar serviço" : "Novo serviço"}
      description="Aparece na sua página pública. Clientes podem pedir orçamento escolhendo este serviço."
      action={saveService}
      submitLabel={service ? "Salvar" : "Adicionar"}
      trigger={trigger}
    >
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      <FormField id="svc-name" label="Nome do serviço">
        <Input
          id="svc-name"
          name="name"
          required
          maxLength={80}
          defaultValue={service?.name}
          placeholder="Ex.: Identidade visual completa"
        />
      </FormField>
      <FormField
        id="svc-description"
        label={
          <>
            Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
          </>
        }
      >
        <Textarea
          id="svc-description"
          name="description"
          rows={3}
          maxLength={400}
          defaultValue={service?.description}
          placeholder="O que está incluso, prazo médio, formato de entrega…"
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="svc-type" label="Como você cobra">
          <Select id="svc-type" name="priceType" defaultValue={service?.priceType ?? "a-partir"}>
            {Object.entries(PRICE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="svc-price" label="Preço" hint="Deixe vazio se for sob consulta.">
          <MoneyInput id="svc-price" name="price" defaultCents={service?.priceCents || undefined} />
        </FormField>
      </div>
    </FormDialog>
  );
}
