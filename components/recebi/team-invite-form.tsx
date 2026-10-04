"use client";

import { Input } from "@/components/ui/input";
import { inviteMember } from "@/lib/recebi/actions/team";
import { CopyButton } from "./copy-button";
import { FormField, Select } from "./fields";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

export function TeamInviteForm() {
  const { state, pending, onSubmit } = useActionForm(inviteMember);
  const link = (state as { link?: string }).link;
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <FormField id="team-email" label="E-mail da pessoa">
          <Input id="team-email" name="email" type="email" required placeholder="assistente@email.com" />
        </FormField>
        <FormField id="team-role" label="Acesso">
          <Select id="team-role" name="role" defaultValue="editor">
            <option value="editor">Editor</option>
            <option value="leitura">Só leitura</option>
          </Select>
        </FormField>
      </div>
      <FormError message={state.error} />
      {state.ok && state.message ? <p className="text-sm font-medium text-income">{state.message}</p> : null}
      {link ? (
        <div className="grid gap-2 rounded-xl bg-muted/60 p-3">
          <p className="font-mono text-xs break-all">{link}</p>
          <CopyButton value={link} label="Copiar link do convite" variant="outline" size="sm" className="w-fit" />
        </div>
      ) : null}
      <SubmitButton pending={pending} className="w-fit">
        Convidar
      </SubmitButton>
    </form>
  );
}
