import { CircleAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { APP_PATH } from "@/lib/recebi/config";

/** Mensagens de limite do plano Grátis ganham um atalho para a página do Pro. */
function isPlanLimit(message: string): boolean {
  return /plano Grátis|plano Pro|recurso do Pro|fazem parte do plano Pro/i.test(message);
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  const upgrade = isPlanLimit(message);
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      {upgrade ? (
        <Link
          href={`${APP_PATH}/plano?limite=1`}
          className="inline-flex items-center gap-1 rounded-md bg-[#101c34] px-2.5 py-1 text-xs font-bold text-[#c9ff3c] hover:bg-[#1b2b4d]"
        >
          <Sparkles className="size-3.5" aria-hidden /> Ver o Pro
        </Link>
      ) : null}
    </div>
  );
}
