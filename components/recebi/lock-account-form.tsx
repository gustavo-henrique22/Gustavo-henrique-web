"use client";

import { lockMyAccount } from "@/lib/recebi/actions/reauth";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

export function LockAccountForm({ token }: { token: string }) {
  const { state, pending, onSubmit } = useActionForm(lockMyAccount);
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <FormError message={state.error} />
      <SubmitButton pending={pending} variant="destructive" className="w-fit">
        Bloquear minha conta agora
      </SubmitButton>
    </form>
  );
}
