"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ActionState } from "@/lib/recebi/action-state";

/** Botão que executa uma server action direto (sem confirmação) e mostra o resultado. */
export function ActionButton({
  action,
  fields,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "action"> & {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending || props.disabled}
      onClick={() => {
        const formData = new FormData();
        for (const [key, value] of Object.entries(fields)) formData.set(key, value);
        startTransition(async () => {
          const result = await action({}, formData);
          if (result?.error) toast.error(result.error);
          else if (result?.message) toast.success(result.message);
        });
      }}
      {...props}
    >
      {pending ? <Spinner /> : children}
    </Button>
  );
}
