"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportError } from "@/components/recebi/report-error";
import { APP_PATH } from "@/lib/recebi/config";

/** Erro dentro do painel: mantém o menu e oferece tentar de novo. */
export default function PainelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-20 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-warning/15 text-warning">
        <TriangleAlert className="size-5" />
      </span>
      <h1 className="text-lg font-bold">Não conseguimos carregar esta parte</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Seus dados estão seguros. Tente de novo; se continuar, volte ao painel.</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-muted-foreground">Código: {error.digest}</p> : null}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Tentar de novo
        </Button>
        <Button variant="outline" asChild>
          <Link href={APP_PATH}>Voltar para o painel</Link>
        </Button>
      </div>
    </div>
  );
}
