// Conquistas: marcos do negócio que aparecem no painel. Código puro (testável).

export type AchievementStats = {
  paidInvoices: number;
  totalReceivedCents: number;
  approvedQuotes: number;
  clients: number;
  /** Lucro de cada mês, do mais antigo ao mais recente. */
  monthlyProfit: number[];
  goalCents: number;
  /** Recebido no mês atual. */
  monthIncomeCents: number;
};

export type Achievement = { key: string; title: string; description: string; earned: boolean };

/** Quantos meses seguidos, terminando no último, tiveram lucro. */
export function profitStreak(monthlyProfit: number[]): number {
  let streak = 0;
  for (let i = monthlyProfit.length - 1; i >= 0 && monthlyProfit[i] > 0; i--) streak++;
  return streak;
}

export function evaluateAchievements(s: AchievementStats): Achievement[] {
  const streak = profitStreak(s.monthlyProfit);
  return [
    {
      key: "primeira-cobranca",
      title: "Primeiro Pix",
      description: "Recebeu a primeira cobrança pelo Recebi",
      earned: s.paidInvoices >= 1,
    },
    { key: "dez-cobrancas", title: "Cobrador de respeito", description: "10 cobranças pagas", earned: s.paidInvoices >= 10 },
    {
      key: "orcamento-aprovado",
      title: "Proposta aceita",
      description: "Primeiro orçamento aprovado pelo cliente",
      earned: s.approvedQuotes >= 1,
    },
    { key: "cinco-clientes", title: "Carteira cheia", description: "5 clientes cadastrados", earned: s.clients >= 5 },
    {
      key: "meta-batida",
      title: "Meta batida",
      description: "Bateu a meta de faturamento do mês",
      earned: s.goalCents > 0 && s.monthIncomeCents >= s.goalCents,
    },
    { key: "tres-meses-lucro", title: "No azul", description: "3 meses seguidos com lucro", earned: streak >= 3 },
    { key: "dez-mil", title: "R$ 10 mil", description: "R$ 10.000 recebidos no total", earned: s.totalReceivedCents >= 1_000_000 },
    { key: "cem-mil", title: "R$ 100 mil", description: "R$ 100.000 recebidos no total", earned: s.totalReceivedCents >= 10_000_000 },
  ];
}
