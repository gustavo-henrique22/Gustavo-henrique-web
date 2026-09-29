import { Lightbulb, TrendingUp } from "lucide-react";
import type { ForecastMonth } from "@/lib/recebi/forecast";
import { capitalize, monthLabel } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

/** Previsão dos próximos meses com base no que já está lançado, cobranças em aberto e recorrências. */
export function ForecastCard({ months, avgIncome }: { months: ForecastMonth[]; avgIncome: number }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const low = months.find((m) => m.lowIncome);
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-xs" aria-labelledby="forecast-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="forecast-title" className="flex items-center gap-2 font-bold">
            <TrendingUp className="size-4" /> Previsão de caixa
          </h2>
          <p className="text-xs text-muted-foreground">Com base no que já está lançado, cobranças em aberto e recorrências</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {months.map((m, i) => (
          <div key={m.month} className="rounded-xl border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              {i === 0 ? "Este mês" : capitalize(monthLabel(m.month).split(" ")[0])}
            </p>
            <p className={cn("mt-1 text-xl font-extrabold tabular", m.result < 0 && "text-destructive")}>{formatMoney(m.result)}</p>
            <div className="mt-3 grid gap-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-14 text-muted-foreground">Entradas</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-income" style={{ width: `${(m.income / max) * 100}%` }} />
                </span>
                <span className="w-20 text-right font-semibold tabular">{formatMoney(m.income)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-14 text-muted-foreground">Saídas</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-expense" style={{ width: `${(m.expense / max) * 100}%` }} />
                </span>
                <span className="w-20 text-right font-semibold tabular">{formatMoney(m.expense)}</span>
              </div>
            </div>
            {m.expenseEstimated ? <p className="mt-2 text-[0.7rem] text-muted-foreground">Saídas estimadas pela sua média.</p> : null}
          </div>
        ))}
      </div>
      {low ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#c9ff3c]/15 px-3 py-2 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0" />
          <span>
            {capitalize(monthLabel(low.month).split(" ")[0])} ainda tem poucas entradas previstas (sua média é {formatMoney(avgIncome)}).
            Bom momento para mandar orçamentos e buscar novos clientes.
          </span>
        </p>
      ) : null}
    </section>
  );
}
