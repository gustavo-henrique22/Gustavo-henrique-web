import { Gift } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/recebi/auth-forms";
import { GoogleButton } from "@/components/recebi/google-button";
import { BASE_PATH } from "@/lib/recebi/config";
import { findReferrer, normalizeReferralCode, REFERRED_TRIAL_DAYS } from "@/lib/recebi/referral";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const code = normalizeReferralCode((await searchParams).ref);
  const referrer = code ? await findReferrer(code) : null;

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Crie sua conta</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">Grátis para começar. Sem cartão de crédito.</p>
      {referrer ? (
        <p className="mb-6 flex items-start gap-3 rounded-xl border border-[#c9ff3c] bg-[#c9ff3c]/20 p-4 text-sm">
          <Gift className="mt-0.5 size-5 shrink-0" />
          <span>
            <strong>{referrer.name.split(" ")[0]}</strong> convidou você! Crie sua conta e ganhe{" "}
            <strong>{REFERRED_TRIAL_DAYS} dias de Recebi Pro</strong> de presente.
          </span>
        </p>
      ) : null}
      <GoogleButton label="Criar conta com Google" />
      <SignUpForm referralCode={referrer ? code : undefined} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href={`${BASE_PATH}/entrar`} className="font-semibold text-foreground underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </>
  );
}
