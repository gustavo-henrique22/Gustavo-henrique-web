import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { addMonths, capitalize, currentMonth, monthLabel } from "@/lib/recebi/dates";

/** Navegação entre meses preservando os outros filtros da URL. */
export function MonthSwitcher({
  month,
  basePath,
  params = {},
}: {
  month: string;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const href = (m: string) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    search.set("mes", m);
    return `${basePath}?${search.toString()}`;
  };
  const isCurrent = month === currentMonth();
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1 shadow-xs">
      <Link
        href={href(addMonths(month, -1))}
        className="grid size-8 place-items-center rounded-lg hover:bg-muted"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="size-4" />
      </Link>
      <span className="min-w-36 px-2 text-center text-sm font-semibold">{capitalize(monthLabel(month))}</span>
      <Link href={href(addMonths(month, 1))} className="grid size-8 place-items-center rounded-lg hover:bg-muted" aria-label="Próximo mês">
        <ChevronRight className="size-4" />
      </Link>
      {!isCurrent ? (
        <Link
          href={href(currentMonth())}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Hoje
        </Link>
      ) : null}
    </div>
  );
}
