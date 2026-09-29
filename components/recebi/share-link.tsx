"use client";

import { ExternalLink, Mail, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/recebi/action-state";
import { ActionButton } from "./action-button";
import { CopyButton } from "./copy-button";

/** Painel para enviar o link de uma cobrança ou orçamento ao cliente. */
export function ShareLink({
  link,
  description,
  whatsappHref,
  mailHref,
  emailAction,
  highlight,
}: {
  link: string;
  description: string;
  whatsappHref: string;
  /** Link mailto de reserva, usado quando o envio automático não está ativo. */
  mailHref: string | null;
  /** Envio automático pelo Recebi (Resend); quando presente, substitui o mailto. */
  emailAction?: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; fields: Record<string, string> } | null;
  highlight?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border bg-card p-5 shadow-xs ${highlight ? "ring-2 ring-[#c9ff3c] ring-offset-2 ring-offset-background" : ""}`}
      aria-labelledby="share-title"
    >
      <h2 id="share-title" className="font-bold">
        {highlight ? "Pronto! Agora envie para o cliente" : "Enviar para o cliente"}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3 flex gap-2">
        <Input
          readOnly
          value={link}
          aria-label="Link para o cliente"
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyButton value={link} variant="outline" label="Copiar" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button asChild className="col-span-2 bg-[#25d366] text-[#073b1c] hover:bg-[#25d366]/90">
          <a href={whatsappHref} target="_blank" rel="noreferrer">
            <MessageCircle /> Enviar pelo WhatsApp
          </a>
        </Button>
        {emailAction ? (
          <ActionButton action={emailAction.action} fields={emailAction.fields} variant="outline">
            <Send /> Enviar e-mail
          </ActionButton>
        ) : mailHref ? (
          <Button asChild variant="outline">
            <a href={mailHref}>
              <Mail /> E-mail
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline" className={emailAction || mailHref ? undefined : "col-span-2"}>
          <a href={link} target="_blank" rel="noreferrer">
            <ExternalLink /> Abrir
          </a>
        </Button>
      </div>
    </section>
  );
}
