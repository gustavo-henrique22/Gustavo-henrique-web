import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/recebi/auth-forms";
import { FormError } from "@/components/recebi/form-error";
import { GoogleButton } from "@/components/recebi/google-button";
import { startDemo } from "@/lib/recebi/actions/demo";
import { BASE_PATH } from "@/lib/recebi/config";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Bem-vindo de volta</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">Entre para ver suas finanças.</p>
      {erro === "google" ? (
        <div className="mb-4">
          <FormError message="Não foi possível entrar com o Google. Tente de novo." />
        </div>
      ) : null}
      <GoogleButton />
      <SignInForm next={next} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href={`${BASE_PATH}/cadastro`} className="font-semibold text-foreground underline underline-offset-2">
          Criar grátis
        </Link>
      </p>
      <form action={startDemo} className="mt-3 text-center">
        <button type="submit" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <Sparkles className="size-4" /> Só quero ver como funciona
        </button>
      </form>
    </>
  );
}
