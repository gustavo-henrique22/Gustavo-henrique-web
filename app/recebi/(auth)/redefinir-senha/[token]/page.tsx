import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/recebi/auth-forms";
import { findValidPasswordReset } from "@/lib/recebi/auth";
import { BASE_PATH } from "@/lib/recebi/config";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await findValidPasswordReset(token);

  if (!reset) {
    return (
      <>
        <h1 className="text-3xl font-extrabold tracking-tight">Link inválido</h1>
        <p className="mt-2 mb-8 text-sm text-muted-foreground">Este link expirou ou já foi usado.</p>
        <Link href={`${BASE_PATH}/esqueci-senha`} className="font-semibold underline underline-offset-2">
          Pedir um novo link
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Crie uma nova senha</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">Depois disso você entra direto no painel.</p>
      <ResetPasswordForm token={token} />
    </>
  );
}
