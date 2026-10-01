import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { VerifyLoginForm } from "@/components/recebi/auth-forms";
import { cancelLoginChallenge } from "@/lib/recebi/actions/two-factor";
import { BASE_PATH } from "@/lib/recebi/config";
import { currentChallenge } from "@/lib/recebi/two-factor";

export const metadata: Metadata = { title: "Verificar acesso", robots: { index: false } };

export default async function VerifyAccessPage() {
  const row = await currentChallenge();

  if (!row) {
    return (
      <>
        <h1 className="text-3xl font-extrabold tracking-tight">Entre de novo</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">
          Por segurança, o código precisa ser digitado em até 10 minutos e com poucas tentativas. Comece o login outra vez.
        </p>
        <Link
          href={`${BASE_PATH}/entrar`}
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Ir para o login
        </Link>
      </>
    );
  }

  return (
    <>
      <span className="grid size-12 place-items-center rounded-2xl bg-[#c9ff3c] text-[#101c34]">
        <ShieldCheck className="size-6" />
      </span>
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Verificação em duas etapas</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        Abra o app autenticador no celular e digite o código do Recebi para entrar como{" "}
        <strong className="text-foreground">{row.user.email}</strong>.
      </p>
      <VerifyLoginForm />
      <form action={cancelLoginChallenge} className="mt-6 text-center">
        <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline">
          Cancelar e voltar ao login
        </button>
      </form>
    </>
  );
}
