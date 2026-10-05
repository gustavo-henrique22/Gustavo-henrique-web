import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/recebi/logo";
import { LockAccountForm } from "@/components/recebi/lock-account-form";
import { lockTokenValid } from "@/lib/recebi/account-lock";
import { BASE_PATH } from "@/lib/recebi/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bloquear minha conta", robots: { index: false, follow: false } };

/** Abrir o link não bloqueia nada (programas de e-mail abrem links sozinhos): é preciso clicar no botão. */
export default async function LockAccountPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await lockTokenValid(token);
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-16">
      <div className="grid max-w-md gap-5">
        <Link href={BASE_PATH} className="w-fit">
          <Logo />
        </Link>
        <ShieldAlert className="size-12 text-destructive" />
        <h1 className="text-2xl font-extrabold">Bloquear minha conta</h1>
        {valid ? (
          <>
            <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
              <li>Todos os aparelhos conectados saem da conta na hora.</li>
              <li>A senha atual e as chaves de acesso deixam de funcionar.</li>
              <li>Para voltar, use “Esqueci a senha”: o link chega no seu e-mail.</li>
            </ul>
            <LockAccountForm token={token} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este link expirou (vale 7 dias) ou já foi usado. Se ainda suspeita de algo, use{" "}
            <Link href={`${BASE_PATH}/esqueci-senha`} className="font-semibold text-foreground underline">
              Esqueci a senha
            </Link>{" "}
            para criar uma senha nova.
          </p>
        )}
      </div>
    </main>
  );
}
