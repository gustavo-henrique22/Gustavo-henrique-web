"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportError } from "@/components/recebi/report-error";
import { BASE_PATH } from "@/lib/recebi/config";

export default function RecebiError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-16 text-center">
      <div className="grid max-w-md justify-items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-warning/15 text-warning">
          <TriangleAlert className="size-6" />
        </span>
        <h1 className="text-2xl font-extrabold">Algo deu errado por aqui</h1>
        <p className="text-sm text-muted-foreground">Foi uma falha momentânea. Tente de novo em alguns segundos.</p>
        {error.digest ? <p className="font-mono text-xs text-muted-foreground">Código: {error.digest}</p> : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw /> Tentar de novo
          </Button>
          <Button variant="outline" asChild>
            <Link href={BASE_PATH}>Página inicial</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
