"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, resetPassword, signIn, signUp } from "@/lib/recebi/actions/auth";
import { BASE_PATH } from "@/lib/recebi/config";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

function Field({ label, children, hint }: { label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      {label}
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const { state, pending, onSubmit } = useActionForm(signIn);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={<Label htmlFor="email">E-mail</Label>}>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@email.com" />
      </Field>
      <Field
        label={
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link
              href={`${BASE_PATH}/esqueci-senha`}
              className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Esqueci a senha
            </Link>
          </div>
        }
      >
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormError message={state.error} />
      <SubmitButton pending={pending} size="lg" className="w-full" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const { state, pending, onSubmit } = useActionForm(signUp);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label={<Label htmlFor="name">Seu nome</Label>}>
        <Input id="name" name="name" autoComplete="name" required placeholder="Ana Souza" />
      </Field>
      <Field
        label={
          <Label htmlFor="businessName">
            Nome profissional <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
        }
      >
        <Input id="businessName" name="businessName" placeholder="Ana Souza Design" />
      </Field>
      <Field label={<Label htmlFor="email">E-mail</Label>}>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@email.com" />
      </Field>
      <Field label={<Label htmlFor="password">Senha</Label>} hint="Mínimo de 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span>
          Li e aceito os{" "}
          <Link href={`${BASE_PATH}/termos`} className="font-medium text-foreground underline underline-offset-2" target="_blank">
            termos de uso e a política de privacidade
          </Link>
          .
        </span>
      </label>
      <FormError message={state.error} />
      <SubmitButton pending={pending} size="lg" className="w-full" pendingLabel="Criando conta…">
        Criar conta grátis
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm({ whatsappHref }: { whatsappHref: string }) {
  const { state, pending, onSubmit } = useActionForm(requestPasswordReset);
  if (state.ok) {
    return <p className="rounded-lg border bg-card p-4 text-sm">{state.message}</p>;
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label={<Label htmlFor="email">E-mail da conta</Label>}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <FormError message={state.error} />
      {state.error?.includes("WhatsApp") ? (
        <a href={whatsappHref} target="_blank" rel="noreferrer" className="text-sm font-semibold underline underline-offset-2">
          Falar com o suporte no WhatsApp
        </a>
      ) : null}
      <SubmitButton pending={pending} size="lg" className="w-full" pendingLabel="Enviando…">
        Enviar link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { state, pending, onSubmit } = useActionForm(resetPassword);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <Field label={<Label htmlFor="password">Nova senha</Label>} hint="Mínimo de 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label={<Label htmlFor="confirm">Repita a nova senha</Label>}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <FormError message={state.error} />
      <SubmitButton pending={pending} size="lg" className="w-full">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
