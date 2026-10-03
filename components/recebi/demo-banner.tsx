import { Sparkles } from "lucide-react";
import { leaveDemo } from "@/lib/recebi/actions/demo";

/** Faixa no topo do painel quando a pessoa está numa conta de demonstração. */
export function DemoBanner() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-[#c9ff3c] px-4 py-2 text-center text-sm text-[#101c34]">
      <p className="flex items-center gap-1.5 font-semibold">
        <Sparkles className="size-4" aria-hidden /> Você está numa demonstração. Os dados são fictícios e somem em 24 horas.
      </p>
      <form action={leaveDemo}>
        <button type="submit" className="rounded-lg bg-[#101c34] px-3 py-1 text-xs font-bold text-white hover:bg-[#1b2b4d]">
          Criar minha conta grátis
        </button>
      </form>
    </div>
  );
}
