import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/recebi/auth-forms";
import { BASE_PATH } from "@/lib/recebi/config";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Crie sua conta</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">Grátis para começar. Sem cartão de crédito.</p>
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href={`${BASE_PATH}/entrar`} className="font-semibold text-foreground underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </>
  );
}
