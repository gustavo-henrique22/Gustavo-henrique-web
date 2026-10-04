"use client";

import { Input } from "@/components/ui/input";
import { confirmIdentity } from "@/lib/recebi/actions/reauth";
import { FormField } from "./fields";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

/** Senha (se a conta tem) e código do app (se ativo) para liberar uma tela sensível. */
export function ConfirmIdentityForm({ next, hasPassword, hasTwoFactor }: { next: string; hasPassword: boolean; hasTwoFactor: boolean }) {
  const { state, pending, onSubmit } = useActionForm(confirmIdentity);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {hasPassword ? (
        <FormField id="confirm-password" label="Sua senha">
          <Input id="confirm-password" name="password" type="password" autoComplete="current-password" required autoFocus />
        </FormField>
      ) : null}
      {hasTwoFactor ? (
        <FormField id="confirm-code" label="Código do app autenticador" hint="Ou um código de recuperação.">
          <Input id="confirm-code" name="code" autoComplete="one-time-code" maxLength={20} required placeholder="000000" />
        </FormField>
      ) : null}
      <FormError message={state.error} />
      <SubmitButton pending={pending} className="w-fit">
        Confirmar
      </SubmitButton>
    </form>
  );
}
