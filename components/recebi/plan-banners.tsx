import { Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/recebi/action-button";
import { switchWorkspace } from "@/lib/recebi/actions/team";
import { APP_PATH } from "@/lib/recebi/config";

/** Faixa no topo quando um membro da equipe está trabalhando na conta de outra pessoa. */
export function TeamBanner({ ownerName, readOnly }: { ownerName: string; readOnly: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-[#101c34] px-4 py-2 text-center text-sm text-white">
      <p className="flex items-center gap-1.5 font-semibold">
        <UsersRound className="size-4 text-[#c9ff3c]" aria-hidden /> Você está na conta de {ownerName}
        {readOnly ? " (só leitura)" : ""}.
      </p>
      <ActionButton
        action={switchWorkspace}
        fields={{ ownerId: "" }}
        size="sm"
        className="h-7 bg-[#c9ff3c] text-xs font-bold text-[#101c34] hover:bg-[#c9ff3c]/90"
      >
        Voltar para minha conta
      </ActionButton>
    </div>
  );
}

/** Faixa do teste grátis do Pro. */
export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b bg-[#c9ff3c]/15 px-4 py-2 text-center text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <Sparkles className="size-4 text-[#7da800] dark:text-brand" aria-hidden />
        {daysLeft <= 0
          ? "Seu teste grátis do Pro termina hoje."
          : `Teste grátis do Pro: ${daysLeft} ${daysLeft === 1 ? "dia restante" : "dias restantes"}.`}
      </p>
      <Link href={`${APP_PATH}/plano`} className="text-xs font-bold underline underline-offset-4">
        Continuar com o Pro
      </Link>
    </div>
  );
}
