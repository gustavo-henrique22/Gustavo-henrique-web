import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/recebi/logo";
import { PriceCalculator } from "@/components/recebi/price-calculator";
import { BASE_PATH } from "@/lib/recebi/config";

export const metadata: Metadata = {
  title: { absolute: "Quanto cobrar por hora? Calculadora grátis para freelancers · Recebi" },
  description:
    "Calcule em segundos o seu valor por hora, diária e preço de projeto como freelancer, já considerando impostos, custos e reserva. Grátis.",
};

export default function PublicCalculatorPage() {
  return (
    <div className="min-h-dvh">
      <header className="bg-[#101c34] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href={BASE_PATH}>
            <Logo />
          </Link>
          <Link
            href={`${BASE_PATH}/cadastro`}
            className="rounded-lg bg-[#c9ff3c] px-3 py-2 text-sm font-bold text-[#101c34] hover:bg-[#d6ff6a]"
          >
            Começar grátis
          </Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-14 sm:px-6">
          <p className="text-xs font-bold tracking-[0.16em] text-[#c9ff3c] uppercase">Calculadora grátis</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">Quanto cobrar por hora como freelancer?</h1>
          <p className="mt-4 max-w-2xl text-white/70">
            Diga quanto quer ganhar e como é sua rotina. A calculadora já considera impostos, custos do trabalho e uma reserva para os meses
            mais fracos.
          </p>
        </div>
      </header>
      <main className="mx-auto -mt-6 max-w-6xl px-4 pb-16 sm:px-6">
        <PriceCalculator defaults={{ desiredCents: 600_000, costsCents: 80_000, taxPercent: 6 }} />
        <section className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl bg-[#c9ff3c] p-6 text-[#101c34] sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Agora acompanhe se está batendo a meta</h2>
            <p className="mt-1 text-sm">No Recebi você envia orçamentos, cobra com Pix e vê quanto sobra de verdade todo mês.</p>
          </div>
          <Link
            href={`${BASE_PATH}/cadastro`}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#101c34] px-5 py-3 font-bold text-white hover:bg-[#1b2b4d]"
          >
            Criar conta grátis <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
