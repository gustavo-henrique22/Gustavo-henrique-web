"use client";

import { CheckCircle2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestQuote } from "@/lib/recebi/actions/public-page";
import { FormField, Select } from "./fields";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

/** Formulário "Pedir orçamento" da página pública do freelancer. */
export function QuoteRequestForm({
  slug,
  services,
  defaultServiceId,
  ownerFirstName,
}: {
  slug: string;
  services: { id: string; name: string }[];
  defaultServiceId?: string;
  ownerFirstName: string;
}) {
  const { state, pending, onSubmit } = useActionForm(requestQuote);

  if (state.ok) {
    return (
      <div className="grid place-items-center gap-3 py-10 text-center">
        <CheckCircle2 className="size-12 text-income" />
        <p className="text-xl font-extrabold">Pedido enviado!</p>
        <p className="max-w-sm text-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="slug" value={slug} />
      {/* Armadilha para robôs: fica escondida das pessoas. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Site
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="req-name" label="Seu nome">
          <Input id="req-name" name="name" required maxLength={120} autoComplete="name" />
        </FormField>
        <FormField id="req-phone" label="WhatsApp">
          <Input id="req-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="(11) 99999-9999" />
        </FormField>
      </div>
      <FormField id="req-email" label="E-mail">
        <Input id="req-email" name="email" type="email" maxLength={160} autoComplete="email" placeholder="voce@email.com" />
      </FormField>
      {services.length > 0 ? (
        <FormField id="req-service" label="Serviço">
          <Select id="req-service" name="serviceId" defaultValue={defaultServiceId ?? ""}>
            <option value="">Ainda não sei / outro</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
      <FormField id="req-message" label="O que você precisa?">
        <Textarea
          id="req-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder={`Conte para ${ownerFirstName} sobre o projeto, o prazo que você imagina e qualquer referência.`}
        />
      </FormField>
      <FormError message={state.error} />
      <SubmitButton pending={pending} size="lg" pendingLabel="Enviando…" className="w-full sm:w-fit">
        <Send /> Pedir orçamento
      </SubmitButton>
      <p className="text-xs text-muted-foreground">Deixe um e-mail ou WhatsApp para receber a resposta. Sem compromisso.</p>
    </form>
  );
}
