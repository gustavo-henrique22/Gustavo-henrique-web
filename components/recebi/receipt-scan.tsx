"use client";

import { Camera, Sparkles } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { Client, Project } from "@/db/schema";
import { saveTransaction } from "@/lib/recebi/actions/finance";
import { readReceipt, type ReceiptSuggestion } from "@/lib/recebi/actions/receipt-ai";
import { FormField, TransactionFields } from "./fields";
import { FormDialog } from "./form-dialog";
import { FormError } from "./form-error";

/** Campos da despesa por foto: a IA lê o comprovante e preenche o formulário. */
function ScanFields({
  clients,
  projects,
  attach,
}: {
  clients: Pick<Client, "id" | "name">[];
  projects: Pick<Project, "id" | "name" | "status">[];
  attach: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<ReceiptSuggestion | null>(null);
  const [version, setVersion] = useState(0);

  function read() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Escolha ou tire a foto do comprovante.");
    startTransition(async () => {
      setError("");
      const data = new FormData();
      data.set("photo", file);
      const result = await readReceipt(data);
      if ("error" in result) return setError(result.error);
      setSuggestion(result);
      setVersion((v) => v + 1);
    });
  }

  return (
    <>
      <FormField
        id="photo"
        label="Foto do comprovante"
        hint={attach ? "A foto também fica anexada à despesa." : "Nota fiscal, cupom, recibo ou comprovante do Pix."}
      >
        <div className="flex gap-2">
          <Input
            ref={fileRef}
            id="photo"
            name={attach ? "attachment" : undefined}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
            className="cursor-pointer"
            onChange={() => setError("")}
          />
          <Button type="button" variant="secondary" onClick={read} disabled={pending}>
            {pending ? <Spinner /> : <Sparkles />} Ler com IA
          </Button>
        </div>
      </FormField>
      <FormError message={error} />
      {suggestion ? <p className="text-xs text-income">Pronto! Confira os campos antes de salvar.</p> : null}
      <TransactionFields key={version} type="despesa" clients={clients} projects={projects} initial={suggestion ?? undefined} />
    </>
  );
}

export function ReceiptScanButton({
  clients,
  projects,
  attach,
}: {
  clients: Pick<Client, "id" | "name">[];
  projects: Pick<Project, "id" | "name" | "status">[];
  attach: boolean;
}) {
  return (
    <FormDialog
      title="Despesa por foto"
      description="Tire uma foto do comprovante e a IA preenche a despesa para você."
      action={saveTransaction}
      submitLabel="Lançar despesa"
      trigger={
        <Button variant="outline">
          <Camera /> Por foto
        </Button>
      }
    >
      <ScanFields clients={clients} projects={projects} attach={attach} />
    </FormDialog>
  );
}
