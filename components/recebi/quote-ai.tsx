"use client";

import { WandSparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { suggestQuote, type SuggestedQuote } from "@/lib/recebi/actions/ai";
import { FormError } from "./form-error";

/** "Montar com IA": descreve o trabalho e recebe os itens com preços sugeridos. */
export function QuoteAiButton({ defaultBrief, onApply }: { defaultBrief?: string; onApply: (result: SuggestedQuote) => void }) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState(defaultBrief ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await suggestQuote(brief);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onApply(result);
      setOpen(false);
      toast.success("Itens sugeridos! Revise os valores antes de enviar.", { description: result.summary || undefined, duration: 8000 });
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="border-[#c9ff3c] bg-[#c9ff3c]/20 hover:bg-[#c9ff3c]/40">
          <WandSparkles /> Montar com IA
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Montar orçamento com IA</DialogTitle>
          <DialogDescription>
            Descreva o trabalho como o cliente pediu. A IA sugere os itens, quantidades e preços com base nos seus serviços e orçamentos
            anteriores.
          </DialogDescription>
        </DialogHeader>
        <label htmlFor="ai-brief" className="sr-only">
          Descrição do trabalho
        </label>
        <Textarea
          id="ai-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={6}
          maxLength={3000}
          placeholder="Ex.: Site institucional para uma clínica de fisioterapia, 5 páginas, com agendamento pelo WhatsApp e blog. Precisam em 30 dias."
        />
        <FormError message={error ?? undefined} />
        <DialogFooter>
          <Button type="button" onClick={run} disabled={pending || brief.trim().length < 10}>
            {pending ? (
              <>
                <Spinner /> Montando os itens…
              </>
            ) : (
              <>
                <WandSparkles /> Sugerir itens
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
