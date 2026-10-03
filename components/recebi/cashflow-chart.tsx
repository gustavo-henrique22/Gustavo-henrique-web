"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { monthLabel, monthShortLabel } from "@/lib/recebi/dates";
import { formatMoney, formatMoneyCompact } from "@/lib/recebi/money";

const config = {
  income: { label: "Receitas", color: "var(--chart-1)" },
  expense: { label: "Despesas", color: "var(--chart-2)" },
  profit: { label: "Lucro", color: "var(--chart-3)" },
} satisfies ChartConfig;

export type CashflowPoint = { month: string; income: number; expense: number; profit: number };

export function CashflowChart({ data, className }: { data: CashflowPoint[]; className?: string }) {
  return (
    <ChartContainer config={config} className={className ?? "aspect-auto h-72 w-full"}>
      <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8 }} barGap={4}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={monthShortLabel} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatMoneyCompact(v).replace("R$ ", "")} />
        <ChartTooltip
          cursor={{ fillOpacity: 0.4 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const month = payload?.[0]?.payload?.month as string | undefined;
                return month ? monthLabel(month) : "";
              }}
              formatter={(value, name, item) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 rounded-[2px]" style={{ background: item.color }} />
                    {config[name as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="font-semibold tabular">{formatMoney(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={[5, 5, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[5, 5, 0, 0]} maxBarSize={28} />
        <Line dataKey="profit" type="linear" stroke="var(--color-profit)" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ChartContainer>
  );
}
