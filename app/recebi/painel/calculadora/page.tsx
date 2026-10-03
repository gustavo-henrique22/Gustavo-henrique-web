import type { Metadata } from "next";
import { PageHeader } from "@/components/recebi/page-header";
import { PriceCalculator } from "@/components/recebi/price-calculator";
import { requireUser } from "@/lib/recebi/auth";
import { monthlySeries } from "@/lib/recebi/data";
import { addMonths, currentMonth } from "@/lib/recebi/dates";

export const metadata: Metadata = { title: "Calculadora de preço" };

export default async function CalculatorPage() {
  const user = await requireUser();
  // Usa a média de despesas dos últimos 3 meses fechados como ponto de partida.
  const series = await monthlySeries(user.id, addMonths(currentMonth(), -1), 3);
  const avgExpenses = Math.round(series.reduce((sum, m) => sum + m.expense, 0) / 3);

  return (
    <>
      <PageHeader
        title="Calculadora de preço"
        description="Descubra quanto cobrar por hora, por dia e por projeto para ganhar o que você quer."
      />
      <PriceCalculator
        defaults={{
          desiredCents: user.monthlyGoalCents > 0 ? Math.round(user.monthlyGoalCents * 0.7) : 600_000,
          costsCents: avgExpenses > 0 ? avgExpenses : 80_000,
          taxPercent: user.taxRateBp / 100,
        }}
      />
    </>
  );
}
