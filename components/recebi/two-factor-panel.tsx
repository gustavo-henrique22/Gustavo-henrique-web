"use client";

import { Download, KeyRound, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  beginTwoFactorSetup,
  cancelTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateRecoveryCodes,
} from "@/lib/recebi/actions/two-factor";
import { ActionButton } from "./action-button";
import { CopyButton } from "./copy-button";
import { FormField } from "./fields";
import { FormDialog } from "./form-dialog";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

type Props =
  | { status: "off" }
  | { status: "setup"; qrSvg: string; secret: string }
  | { status: "on"; enabledAt: string; codesLeft: number; needsPassword: boolean };

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = `Códigos de recuperação do Recebi\nCada código funciona uma única vez.\n\n${codes.join("\n")}\n`;
  return (
    <div className="grid gap-4 rounded-xl border border-warning/40 bg-warning/5 p-4">
      <div>
        <p className="flex items-center gap-2 font-semibold">
          <KeyRound className="size-4" /> Guarde seus códigos de recuperação
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Se perder o celular, cada código abaixo permite entrar uma vez. Eles <strong>não serão mostrados de novo</strong>: salve em um
          gerenciador de senhas ou imprima.
        </p>
      </div>
      <ol className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-3">
        {codes.map((code) => (
          <li key={code} className="rounded-md bg-card px-2 py-1.5 text-center tracking-wider">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <CopyButton value={text} label="Copiar" variant="outline" size="sm" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "recebi-codigos-de-recuperacao.txt";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download /> Baixar .txt
        </Button>
        <Button type="button" size="sm" onClick={onDone}>
          Já guardei
        </Button>
      </div>
    </div>
  );
}

function ConfirmSetupForm({ onCodes }: { onCodes: (codes: string[]) => void }) {
  const { state, pending, onSubmit } = useActionForm(async (prev, formData) => {
    const result = await confirmTwoFactorSetup(prev, formData);
    if (result.ok && result.codes) {
      toast.success(result.message ?? "Ativada.");
      onCodes(result.codes);
    }
    return result;
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <FormField id="totp-code" label="Código de 6 números que aparece no app">
        <Input
          id="totp-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          placeholder="000000"
          className="max-w-40 text-center text-lg font-semibold tracking-[0.3em] tabular"
        />
      </FormField>
      <FormError message={state.error} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending}>Confirmar e ativar</SubmitButton>
        <ActionButton action={cancelTwoFactorSetup} fields={{}} variant="ghost">
          Cancelar
        </ActionButton>
      </div>
    </form>
  );
}

function IdentityFields({ needsPassword, prefix }: { needsPassword: boolean; prefix: string }) {
  return (
    <>
      {needsPassword ? (
        <FormField id={`${prefix}-password`} label="Sua senha">
          <Input id={`${prefix}-password`} name="password" type="password" autoComplete="current-password" required />
        </FormField>
      ) : null}
      <FormField id={`${prefix}-code`} label="Código do app (ou um código de recuperação)">
        <Input id={`${prefix}-code`} name="code" autoComplete="one-time-code" maxLength={20} required placeholder="000000" />
      </FormField>
    </>
  );
}

/** Seção "Verificação em duas etapas" de Configurações → Segurança. */
export function TwoFactorPanel(props: Props) {
  const router = useRouter();
  const [codes, setCodes] = useState<string[] | null>(null);

  if (codes) {
    return (
      <RecoveryCodes
        codes={codes}
        onDone={() => {
          setCodes(null);
          router.refresh();
        }}
      />
    );
  }

  if (props.status === "off") {
    return (
      <div className="grid gap-4">
        <p className="flex items-start gap-3 text-sm">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <span>
            Além da senha, o Recebi passa a pedir um código que muda a cada 30 segundos no seu celular. Mesmo que alguém descubra sua senha,
            não consegue entrar. Funciona com Google Authenticator, Microsoft Authenticator, Authy ou 1Password.
          </span>
        </p>
        <ActionButton action={beginTwoFactorSetup} fields={{}} className="w-fit">
          <ShieldCheck /> Ativar verificação em duas etapas
        </ActionButton>
      </div>
    );
  }

  if (props.status === "setup") {
    return (
      <div className="grid gap-5">
        <ol className="grid gap-1 text-sm">
          <li>
            <strong>1.</strong> Abra o app autenticador e toque em <strong>adicionar</strong> (+).
          </li>
          <li>
            <strong>2.</strong> Leia o QR Code abaixo (ou digite a chave).
          </li>
          <li>
            <strong>3.</strong> Digite o código de 6 números que o app mostrar.
          </li>
        </ol>
        <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
          <div
            className="w-44 overflow-hidden rounded-xl border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
            role="img"
            aria-label="QR Code para o app autenticador"
            dangerouslySetInnerHTML={{ __html: props.qrSvg }}
          />
          <div className="grid gap-2">
            <p className="text-xs text-muted-foreground">Não consegue ler? Digite esta chave no app:</p>
            <p className="rounded-lg bg-muted px-3 py-2 font-mono text-sm tracking-wider break-all">{props.secret}</p>
            <CopyButton value={props.secret.replace(/\s/g, "")} label="Copiar chave" variant="outline" size="sm" className="w-fit" />
          </div>
        </div>
        <ConfirmSetupForm onCodes={setCodes} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <span className="inline-flex items-center gap-1 rounded-full bg-income/15 px-2 py-0.5 text-xs font-semibold text-income">
          <ShieldCheck className="size-3.5" /> Ativada
        </span>
        <span className="text-muted-foreground" suppressHydrationWarning>
          desde {new Date(props.enabledAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </span>
      </p>
      <p className={props.codesLeft <= 3 ? "text-sm text-warning" : "text-sm text-muted-foreground"}>
        {props.codesLeft === 1 ? "Resta 1 código de recuperação." : `Restam ${props.codesLeft} códigos de recuperação.`}
        {props.codesLeft <= 3 ? " Gere novos para não ficar sem acesso." : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <FormDialog
          title="Gerar novos códigos de recuperação"
          description="Os códigos antigos deixam de valer."
          action={regenerateRecoveryCodes}
          submitLabel="Gerar códigos"
          onSuccess={(state) => state.codes && setCodes(state.codes)}
          trigger={
            <Button variant="outline">
              <KeyRound /> Novos códigos de recuperação
            </Button>
          }
        >
          <IdentityFields needsPassword={props.needsPassword} prefix="regen" />
        </FormDialog>
        <FormDialog
          title="Desativar a verificação em duas etapas?"
          description="Sua conta volta a pedir só a senha. Você recebe um aviso por e-mail."
          action={disableTwoFactor}
          submitLabel="Desativar"
          trigger={
            <Button variant="ghost" className="text-destructive hover:text-destructive">
              <ShieldOff /> Desativar
            </Button>
          }
        >
          <IdentityFields needsPassword={props.needsPassword} prefix="off" />
        </FormDialog>
      </div>
    </div>
  );
}
