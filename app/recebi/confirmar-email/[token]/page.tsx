import { CircleCheck, CircleX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/recebi/logo";
import { APP_PATH, BASE_PATH } from "@/lib/recebi/config";
import { confirmEmailToken } from "@/lib/recebi/email-verification";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmar e-mail", robots: { index: false, follow: false } };

export default async function ConfirmEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const userId = await confirmEmailToken((await params).token);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-16 text-center">
      <div className="grid max-w-md justify-items-center gap-4">
        <Link href={BASE_PATH}>
          <Logo />
        </Link>
        {userId ? (
          <>
            <CircleCheck className="size-14 text-income" />
            <h1 className="text-2xl font-extrabold">E-mail confirmado!</h1>
            <p className="text-sm text-muted-foreground">Tudo certo. Sua conta está mais protegida e você recebe os avisos importantes.</p>
            <Button asChild>
              <Link href={APP_PATH}>Ir para o painel</Link>
            </Button>
          </>
        ) : (
          <>
            <CircleX className="size-14 text-destructive" />
            <h1 className="text-2xl font-extrabold">Link inválido ou vencido</h1>
            <p className="text-sm text-muted-foreground">
              O link pode ter expirado (vale 48 horas) ou já foi usado. Peça um novo em Configurações → Segurança.
            </p>
            <Button asChild>
              <Link href={`${APP_PATH}/configuracoes/seguranca#email`}>Pedir um novo link</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
