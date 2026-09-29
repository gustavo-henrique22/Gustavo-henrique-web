import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/recebi/auth-forms";
import { BASE_PATH, whatsappLink } from "@/lib/recebi/config";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Esqueceu a senha?</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">Informe seu e-mail e enviaremos um link para criar uma nova.</p>
      <ForgotPasswordForm whatsappHref={whatsappLink("Olá! Esqueci minha senha do Recebi.")} />
      <p className="mt-6 text-center text-sm">
        <Link href={`${BASE_PATH}/entrar`} className="font-semibold underline underline-offset-2">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
