"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionState } from "@/lib/recebi/action-state";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

type Props = {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
  children: React.ReactNode;
  wide?: boolean;
  /** Abre ao carregar a página (ex.: link "?novo=receita" da busca rápida). */
  defaultOpen?: boolean;
  /** Recebe o resultado quando a ação dá certo (só em componentes de cliente). */
  onSuccess?: (state: ActionState) => void;
};

/** Diálogo com formulário que chama uma server action e fecha quando dá certo. */
export function FormDialog({ trigger, title, description, action, submitLabel = "Salvar", children, wide, defaultOpen, onSuccess }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);

  useEffect(() => {
    if (!defaultOpen) return;
    // Tira o "?novo=..." da barra de endereço para o diálogo não reabrir ao recarregar.
    const url = new URL(window.location.href);
    url.searchParams.delete("novo");
    window.history.replaceState(window.history.state, "", url);
  }, [defaultOpen]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className={wide ? "max-h-[92dvh] overflow-y-auto sm:max-w-2xl" : "max-h-[92dvh] overflow-y-auto"}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {open ? (
          <DialogForm
            action={action}
            submitLabel={submitLabel}
            onDone={(state) => {
              setOpen(false);
              onSuccess?.(state);
            }}
          >
            {children}
          </DialogForm>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DialogForm({
  action,
  submitLabel,
  onDone,
  children,
}: {
  action: Props["action"];
  submitLabel: string;
  onDone: (state: ActionState) => void;
  children: React.ReactNode;
}) {
  const { state, pending, onSubmit } = useActionForm(action);

  useEffect(() => {
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onDone(state);
    }
  }, [state, onDone]);

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {children}
      <FormError message={state.error} />
      <DialogFooter className="gap-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </DialogClose>
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
