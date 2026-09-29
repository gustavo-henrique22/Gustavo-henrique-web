"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/recebi/action-state";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

/** Formulário de página inteira que chama uma server action e avisa o resultado com um toast. */
export function ActionForm({
  action,
  submitLabel = "Salvar",
  submitVariant,
  children,
  className,
  resetOnSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
  submitVariant?: "default" | "destructive" | "outline";
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const { state, pending, onSubmit } = useActionForm(action);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    if (state.message) toast.success(state.message);
    if (resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className={className ?? "grid gap-4"}>
      {children}
      <FormError message={state.error} />
      <div>
        <SubmitButton variant={submitVariant} pending={pending}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
