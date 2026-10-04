// Previsão do MEI: DAS do ano e risco de passar do limite anual de faturamento. Código puro (testável).

/** DAS mensal do MEI de serviços quando a pessoa não informou o valor (5% do salário mínimo + ISS). */
export const DEFAULT_DAS_CENTS = 8_600;

export type MeiForecast = {
  dasMonthly: number;
  dasYear: number;
  dasRemaining: number;
  projectedIncome: number;
  limit: number;
  usedPercent: number;
  projectedPercent: number;
  /** "ok", "atencao" (passa de 80% na projeção), "estoura" (projeção acima do limite) ou "passou". */
  level: "ok" | "atencao" | "estoura" | "passou";
  /** Mês (1-12) em que o limite deve ser atingido no ritmo atual, se for no ano. */
  limitMonth: number | null;
};

export function meiForecast({
  incomeYear,
  monthsElapsed,
  annualLimitCents,
  dasCents,
}: {
  incomeYear: number;
  monthsElapsed: number;
  annualLimitCents: number;
  dasCents: number;
}): MeiForecast {
  const dasMonthly = dasCents > 0 ? dasCents : DEFAULT_DAS_CENTS;
  const months = Math.min(Math.max(monthsElapsed, 0), 12);
  const perMonth = months > 0 ? incomeYear / months : 0;
  const projectedIncome = Math.round(perMonth * 12);
  const limit = annualLimitCents;
  const usedPercent = limit > 0 ? Math.round((incomeYear / limit) * 100) : 0;
  const projectedPercent = limit > 0 ? Math.round((projectedIncome / limit) * 100) : 0;
  const level = usedPercent >= 100 ? "passou" : projectedPercent > 100 ? "estoura" : projectedPercent >= 80 ? "atencao" : "ok";
  const limitMonth = perMonth > 0 && limit > 0 && projectedIncome > limit ? Math.min(12, Math.ceil(limit / perMonth)) : null;
  return {
    dasMonthly,
    dasYear: dasMonthly * 12,
    dasRemaining: dasMonthly * (12 - months),
    projectedIncome,
    limit,
    usedPercent,
    projectedPercent,
    level,
    limitMonth,
  };
}
