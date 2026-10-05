"use client";

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  finishPasskeyConfirm,
  finishPasskeyLogin,
  finishPasskeyRegistration,
  startPasskeyConfirm,
  startPasskeyLogin,
  startPasskeyRegistration,
} from "@/lib/recebi/actions/passkeys";
import { FormError } from "./form-error";

/** O navegador recusou ou a pessoa cancelou a janela da digital/rosto. */
function cancelled(error: unknown): boolean {
  return error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError");
}

/** Só sabemos se o navegador aceita chaves de acesso depois de carregar no aparelho. */
function useSupported(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => browserSupportsWebAuthn(),
    () => false,
  );
}

/** "Entrar com chave de acesso" na tela de login. */
export function PasskeyLoginButton({ next }: { next?: string }) {
  const supported = useSupported();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (!supported) return null;
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError("");
            const start = await startPasskeyLogin();
            if (!start.ok) return setError(start.error);
            try {
              const response = await startAuthentication({ optionsJSON: start.options });
              const result = await finishPasskeyLogin(response, next ?? "");
              if (!result.ok) return setError(result.error ?? "Não foi possível entrar.");
              window.location.assign(result.redirect ?? "/recebi/painel");
            } catch (err) {
              if (!cancelled(err)) setError("Não foi possível usar a chave de acesso neste aparelho.");
            }
          })
        }
      >
        {pending ? <Spinner /> : <Fingerprint />} Entrar com chave de acesso
      </Button>
      <FormError message={error} />
    </div>
  );
}

/** Cadastrar uma chave de acesso neste aparelho (Configurações → Segurança). */
export function PasskeyRegisterForm() {
  const supported = useSupported();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">Este navegador não aceita chaves de acesso. Tente pelo celular ou outro navegador.</p>
    );
  }
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError("");
          const start = await startPasskeyRegistration();
          if (!start.ok) return setError(start.error);
          try {
            const response = await startRegistration({ optionsJSON: start.options });
            const result = await finishPasskeyRegistration(response, name);
            if (!result.ok) return setError(result.error ?? "Não foi possível criar a chave.");
            toast.success(result.message ?? "Chave criada.");
            setName("");
            router.refresh();
          } catch (err) {
            if (!cancelled(err)) setError("Não foi possível criar a chave neste aparelho.");
          }
        });
      }}
    >
      <div className="grid gap-2">
        <label htmlFor="passkey-name" className="text-sm font-medium">
          Nome do aparelho
        </label>
        <Input
          id="passkey-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          placeholder="Ex.: Meu celular"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : <KeyRound />} Criar chave de acesso
      </Button>
      <div className="sm:col-span-2">
        <FormError message={error} />
      </div>
    </form>
  );
}

/** Confirmar a identidade com a chave de acesso (tela "Confirme que é você"). */
export function PasskeyConfirmButton({ next }: { next: string }) {
  const supported = useSupported();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (!supported) return null;
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError("");
            const start = await startPasskeyConfirm();
            if (!start.ok) return setError(start.error);
            try {
              const response = await startAuthentication({ optionsJSON: start.options });
              const result = await finishPasskeyConfirm(response);
              if (!result.ok) return setError(result.error ?? "Não foi possível confirmar.");
              window.location.assign(next);
            } catch (err) {
              if (!cancelled(err)) setError("Não foi possível usar a chave de acesso neste aparelho.");
            }
          })
        }
      >
        {pending ? <Spinner /> : <Fingerprint />} Confirmar com chave de acesso
      </Button>
      <FormError message={error} />
    </div>
  );
}
