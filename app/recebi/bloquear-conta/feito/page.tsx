import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/recebi/logo";
import { BASE_PATH } from "@/lib/recebi/config";

export const metadata: Metadata = { title: "Conta bloqueada", robots: { index: false, follow: false } };

export default function LockedPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-16">
      <div className="grid max-w-md justify-items-start gap-4">
        <Link href={BASE_PATH}>
          <Logo />
        </Link>
        <CircleCheck className="size-12 text-income" />
        <h1 className="text-2xl font-extrabold">Conta bloqueada</h1>
        <p className="text-sm text-muted-foreground">
          Ninguém mais está conectado e a senha antiga não funciona. Crie uma senha nova para voltar a entrar. Depois, ative a verificação
          em duas etapas ou uma chave de acesso.
        </p>
        <Button asChild>
          <Link href={`${BASE_PATH}/esqueci-senha`}>Criar uma senha nova</Link>
        </Button>
      </div>
    </main>
  );
}
