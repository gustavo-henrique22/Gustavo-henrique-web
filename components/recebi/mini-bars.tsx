"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

type Bar = { label: string; value: number };

/**
 * Colunas simples de uma série só (sem legenda: o título diz o que é).
 * Colunas finas com topo arredondado, dica ao passar o mouse e tabela para leitores de tela.
 */
export function MiniBars({
  data,
  kind = "count",
  caption,
  height = 140,
  labelEvery = 1,
  emptyText,
}: {
  data: Bar[];
  /** Como mostrar os valores: contagem ou dinheiro (em centavos). */
  kind?: "count" | "money";
  caption: string;
  height?: number;
  /** Mostrar o rótulo do eixo a cada N colunas (para séries longas). */
  labelEvery?: number;
  /** Mensagem no lugar das colunas quando tudo é zero. */
  emptyText?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const format = (value: number) => (kind === "money" ? formatMoney(value) : value.toLocaleString("pt-BR"));
  const max = Math.max(1, ...data.map((d) => d.value));
  const current = active === null ? null : data[active];
  if (emptyText && data.every((d) => d.value === 0)) {
    return (
      <p className="grid place-items-center rounded-xl border border-dashed text-sm text-muted-foreground" style={{ height: height + 20 }}>
        {emptyText}
      </p>
    );
  }

  return (
    <figure className="relative">
      <div className="relative flex items-end gap-0.5 border-b" style={{ height }} onMouseLeave={() => setActive(null)}>
        {data.map((bar, i) => {
          const h = bar.value > 0 ? Math.max(3, Math.round((bar.value / max) * (height - 8))) : 0;
          return (
            <button
              key={bar.label + i}
              type="button"
              aria-label={`${bar.label}: ${format(bar.value)}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group flex h-full flex-1 items-end justify-center outline-none"
            >
              <span
                className={cn(
                  "block w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity dark:bg-[#c9ff3c]",
                  active !== null && active !== i && "opacity-40",
                  "group-focus-visible:ring-2 group-focus-visible:ring-ring",
                )}
                style={{ height: h }}
              />
            </button>
          );
        })}
        {current ? (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md"
            style={{ left: `${Math.min(85, Math.max(15, ((active! + 0.5) / data.length) * 100))}%` }}
          >
            <span className="text-muted-foreground">{current.label}</span> ·{" "}
            <strong className="tabular-nums">{format(current.value)}</strong>
          </div>
        ) : null}
      </div>
      <div className="relative mt-1 h-4 text-[0.65rem] text-muted-foreground" aria-hidden>
        {data.map((bar, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <span
              key={bar.label + i}
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${((i + 0.5) / data.length) * 100}%` }}
            >
              {bar.label}
            </span>
          ) : null,
        )}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((bar, i) => (
            <tr key={bar.label + i}>
              <th scope="row">{bar.label}</th>
              <td>{format(bar.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
