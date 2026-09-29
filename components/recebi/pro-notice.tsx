import { Sparkles } from "lucide-react";
import Link from "next/link";
import { APP_PATH } from "@/lib/recebi/config";

/** Aviso de recurso do plano Pro, com link para conhecer o plano. */
export function ProNotice({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">{text}</p>
      <Link
        href={`${APP_PATH}/plano`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#c9ff3c] px-3 py-1.5 text-xs font-bold text-[#101c34]"
      >
        <Sparkles className="size-3.5" /> Conhecer o Pro
      </Link>
    </div>
  );
}
