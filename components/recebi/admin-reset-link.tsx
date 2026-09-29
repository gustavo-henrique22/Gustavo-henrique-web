"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { initialActionState } from "@/lib/recebi/action-state";
import { createResetLink } from "@/lib/recebi/actions/admin";
import { CopyButton } from "./copy-button";
import { FormError } from "./form-error";

/** Gera um link de redefinição de senha para o admin enviar manualmente (ex.: WhatsApp). */
export function AdminResetLink({ userId, email }: { userId: string; email: string }) {
  const [state, action, pending] = useActionState(createResetLink, initialActionState);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Link de nova senha" aria-label={`Gerar link de nova senha para ${email}`}>
          <KeyRound />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link de nova senha</DialogTitle>
          <DialogDescription>Para {email}. O link vale por 24 horas e só pode ser usado uma vez.</DialogDescription>
        </DialogHeader>
        {state?.ok && state.message ? (
          <div className="flex gap-2">
            <Input readOnly value={state.message} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <CopyButton value={state.message} />
          </div>
        ) : (
          <form action={action}>
            <input type="hidden" name="userId" value={userId} />
            <FormError message={state?.error} />
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : null} Gerar link
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
