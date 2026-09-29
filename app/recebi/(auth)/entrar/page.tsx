import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/recebi/auth-forms";
import { BASE_PATH } from "@/lib/recebi/config";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Bem-vindo de volta</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">Entre para ver suas finanças.</p>
      <SignInForm next={next} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href={`${BASE_PATH}/cadastro`} className="font-semibold text-foreground underline underline-offset-2">
          Criar grátis
        </Link>
      </p>
    </>
  );
}
