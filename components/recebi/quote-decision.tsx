"use client";

import { CheckCircle2, ShieldCheck, ThumbsDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { approveQuoteByClient, rejectQuoteByClient } from "@/lib/recebi/actions/quotes";
import { formatMoney } from "@/lib/recebi/money";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

/** Botões para o cliente aprovar ou recusar o orçamento pelo link. */
export function QuoteDecision({
  token,
  totalCents,
  ownerName,
  hasContract = false,
}: {
  token: string;
  totalCents: number;
  ownerName: string;
  hasContract?: boolean;
}) {
  const approve = useActionForm(approveQuoteByClient);
  const reject = useActionForm(rejectQuoteByClient);
  const [rejecting, setRejecting] = useState(false);

  if (reject.state.ok) {
    return (
      <section className="rounded-2xl border bg-card p-6 text-center shadow-xs">
        <p className="text-lg font-bold">Resposta enviada</p>
        <p className="mt-1 text-sm text-muted-foreground">{ownerName} vai receber seu retorno. Obrigado!</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border-2 border-[#101c34] bg-card p-6 shadow-[8px_8px_0_#c9ff3c] dark:border-[#c9ff3c]"
      aria-labelledby="decisao"
    >
      <h2 id="decisao" className="text-lg font-extrabold">
        Gostou da proposta?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ao aprovar, você recebe na hora a cobrança de <strong className="text-foreground">{formatMoney(totalCents)}</strong> com Pix para
        pagamento.
      </p>

      {!rejecting ? (
        <form onSubmit={approve.onSubmit} className="mt-5 grid gap-3">
          <input type="hidden" name="token" value={token} />
          <div className="grid gap-1.5">
            <label htmlFor="acceptedName" className="text-sm font-medium">
              Seu nome completo
            </label>
            <Input
              id="acceptedName"
              name="acceptedName"
              required
              minLength={3}
              maxLength={120}
              autoComplete="name"
              placeholder="Como vai constar no aceite"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="accept" required className="mt-0.5 size-4 accent-[var(--primary)]" />
            <span>
              {hasContract
                ? "Li e aceito os itens, valores, condições e o contrato deste orçamento."
                : "Li e aceito os itens, valores e condições deste orçamento."}
            </span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton
              pending={approve.pending}
              size="lg"
              className="flex-1 bg-income text-white hover:bg-income/90"
              pendingLabel="Aprovando…"
            >
              <CheckCircle2 /> Aprovar orçamento
            </SubmitButton>
            <Button type="button" variant="outline" size="lg" onClick={() => setRejecting(true)}>
              <ThumbsDown /> Recusar
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" /> Registramos seu nome, a data, a hora e o endereço de rede como comprovante do
            aceite.
          </p>
        </form>
      ) : (
        <form onSubmit={reject.onSubmit} className="mt-5 grid gap-3">
          <input type="hidden" name="token" value={token} />
          <label htmlFor="note" className="text-sm font-medium">
            Quer contar o motivo? <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <Textarea id="note" name="note" rows={3} maxLength={500} placeholder="Ex.: O prazo ficou apertado para nós." />
          <FormError message={reject.state.error} />
          <div className="flex gap-2">
            <SubmitButton pending={reject.pending} variant="destructive">
              Recusar orçamento
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
              Voltar
            </Button>
          </div>
        </form>
      )}
      <FormError message={approve.state.error} />
    </section>
  );
}
