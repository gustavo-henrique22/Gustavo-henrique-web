import { ChevronLeft, ChevronRight, Download, Lock, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CashflowChart } from "@/components/recebi/cashflow-chart";
import { PageHeader } from "@/components/recebi/page-header";
import { StatCard } from "@/components/recebi/stat-card";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { incomeByClient, monthlySeries, totalsByCategory } from "@/lib/recebi/data";
import { addDays, capitalize, currentMonth, monthLabel, todayISO } from "@/lib/recebi/dates";
import { formatMoney, formatPercentBp } from "@/lib/recebi/money";
import { latePayers, meiForecast, profitByClient, profitByProject } from "@/lib/recebi/pro-reports";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Relatórios" };

const DEMO_ROWS = [
  { label: "Exemplo A", total: 540_000 },
  { label: "Exemplo B", total: 320_000 },
  { label: "Exemplo C", total: 180_000 },
  { label: "Exemplo D", total: 90_000 },
];

const DEMO_PROFIT = DEMO_ROWS.map((r, i) => ({
  id: String(i),
  label: r.label,
  income: r.total,
  expense: Math.round(r.total / 4),
  profit: r.total - Math.round(r.total / 4),
  margin: 75,
}));

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const user = await requireUser();
  const { ano } = await searchParams;
  const thisYear = Number(currentMonth().slice(0, 4));
  const year = ano && /^\d{4}$/.test(ano) && Number(ano) > 1999 && Number(ano) <= thisYear + 1 ? Number(ano) : thisYear;
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const pro = hasPro(user);

  const [series, expenseCategories, incomeCategories, clients, byClient, byProject, late] = await Promise.all([
    monthlySeries(user.id, `${year}-12`, 12),
    totalsByCategory(user.id, "despesa", start, end),
    totalsByCategory(user.id, "receita", start, end),
    incomeByClient(user.id, start, end, 10),
    pro ? profitByClient(user.id, start, end) : Promise.resolve([]),
    pro ? profitByProject(user.id, start, end) : Promise.resolve([]),
    pro ? latePayers(user.id, addDays(todayISO(), -365)) : Promise.resolve([]),
  ]);

  const income = series.reduce((s, m) => s + m.income, 0);
  const expense = series.reduce((s, m) => s + m.expense, 0);
  const profit = income - expense;
  const monthsElapsed = year < thisYear ? 12 : year > thisYear ? 0 : Number(currentMonth().slice(5, 7));
  const avgProfit = monthsElapsed > 0 ? Math.round(profit / monthsElapsed) : 0;
  const tax = Math.round((income * user.taxRateBp) / 10_000);
  const limitPercent = user.annualLimitCents > 0 ? Math.round((income / user.annualLimitCents) * 100) : null;
  const mei = meiForecast({ incomeYear: income, monthsElapsed, annualLimitCents: user.annualLimitCents, dasCents: user.dasCents });
  const best = series.reduce((a, b) => (b.profit > a.profit ? b : a), series[0]);
  // No plano Grátis mostramos um exemplo borrado em vez dos dados reais.
  const gated = (rows: { label: string; total: number }[]) => (pro ? rows : DEMO_ROWS);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Seu ano em números, para decidir melhor e conversar com o contador."
        actions={
          <>
            <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1 shadow-xs">
              <Link
                href={`${APP_PATH}/relatorios?ano=${year - 1}`}
                className="grid size-8 place-items-center rounded-lg hover:bg-muted"
                aria-label="Ano anterior"
              >
                <ChevronLeft className="size-4" />
              </Link>
              <span className="px-3 text-sm font-bold tabular">{year}</span>
              <Link
                href={`${APP_PATH}/relatorios?ano=${year + 1}`}
                className={cn(
                  "grid size-8 place-items-center rounded-lg hover:bg-muted",
                  year >= thisYear + 1 && "pointer-events-none opacity-40",
                )}
                aria-label="Próximo ano"
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <Button asChild variant="outline">
              <a href={`${APP_PATH}/relatorios/exportar?ano=${year}`}>
                <Download /> Exportar CSV
              </a>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Faturamento" value={formatMoney(income)} tone="income" hint={`Receitas pagas em ${year}`} />
        <StatCard label="Despesas" value={formatMoney(expense)} tone="expense" hint={`Despesas pagas em ${year}`} />
        <StatCard
          label="Lucro"
          value={formatMoney(profit)}
          tone="brand"
          hint={income > 0 ? `Margem de ${Math.round((profit / income) * 100)}%` : "—"}
        />
        <StatCard
          label="Lucro médio por mês"
          value={formatMoney(avgProfit)}
          hint={best && best.profit > 0 ? `Melhor mês: ${monthLabel(best.month)}` : "Sem dados ainda"}
        />
      </div>

      <section className="mt-4 rounded-2xl border bg-card p-5 shadow-xs">
        <h2 className="font-bold">Mês a mês</h2>
        <p className="mb-4 text-xs text-muted-foreground">Receitas e despesas pagas em {year}</p>
        <CashflowChart data={series} className="aspect-auto h-80 w-full" />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <h2 className="p-5 pb-3 font-bold">Tabela mensal</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-semibold">Mês</th>
                  <th className="px-3 py-2 text-right font-semibold">Receitas</th>
                  <th className="px-3 py-2 text-right font-semibold">Despesas</th>
                  <th className="px-5 py-2 text-right font-semibold">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {series.map((m) => (
                  <tr key={m.month} className="border-b last:border-0">
                    <td className="px-5 py-2">{capitalize(monthLabel(m.month).split(" ")[0])}</td>
                    <td className={cn("px-3 py-2 text-right tabular", m.income ? "text-income" : "text-muted-foreground")}>
                      {m.income ? formatMoney(m.income) : "—"}
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular", m.expense ? "text-expense" : "text-muted-foreground")}>
                      {m.expense ? formatMoney(m.expense) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-5 py-2 text-right font-semibold tabular",
                        m.profit < 0 && "text-destructive",
                        !m.income && !m.expense && "font-normal text-muted-foreground",
                      )}
                    >
                      {m.income || m.expense ? formatMoney(m.profit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/50 font-bold">
                  <td className="px-5 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular">{formatMoney(income)}</td>
                  <td className="px-3 py-2 text-right tabular">{formatMoney(expense)}</td>
                  <td className="px-5 py-2 text-right tabular">{formatMoney(profit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div className="grid content-start gap-4">
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h2 className="font-bold">Impostos e limite</h2>
            <dl className="mt-3 grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Imposto estimado ({formatPercentBp(user.taxRateBp)} do faturamento)</dt>
                <dd className="font-bold tabular">{formatMoney(tax)}</dd>
              </div>
              {limitPercent !== null ? (
                <div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Limite anual ({formatMoney(user.annualLimitCents)})</dt>
                    <dd className="font-bold tabular">{limitPercent}%</dd>
                  </div>
                  <Progress
                    value={Math.min(100, limitPercent)}
                    className={cn("mt-2 h-2.5 bg-muted", limitPercent >= 80 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")}
                    aria-label="Uso do limite anual"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {user.annualLimitCents > income
                      ? `Ainda cabem ${formatMoney(user.annualLimitCents - income)} este ano.`
                      : "Limite ultrapassado."}
                  </p>
                </div>
              ) : null}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Estimativa para planejamento. Confirme valores com seu contador.</p>
          </section>

          <ProGate pro={pro}>
            <Breakdown
              title="Para onde vai o dinheiro"
              subtitle="Despesas por categoria"
              rows={gated(expenseCategories.map((c) => ({ label: c.category, total: c.total })))}
              tone="expense"
            />
          </ProGate>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ProGate pro={pro}>
          <Breakdown
            title="De onde vem o dinheiro"
            subtitle="Receitas por categoria"
            rows={gated(incomeCategories.map((c) => ({ label: c.category, total: c.total })))}
            tone="income"
          />
        </ProGate>
        <ProGate pro={pro}>
          <Breakdown
            title="Receita por cliente"
            subtitle="Top 10 clientes do ano"
            rows={gated(clients.map((c) => ({ label: c.name ?? "Sem cliente", total: c.total })))}
            tone="income"
          />
        </ProGate>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-bold">Relatórios Pro</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <ProGate pro={pro}>
          <ProfitTable
            title="Lucro por cliente"
            subtitle="Receitas menos despesas ligadas a cada cliente, no ano"
            rows={pro ? byClient : DEMO_PROFIT}
          />
        </ProGate>
        <ProGate pro={pro}>
          <ProfitTable
            title="Lucro por projeto"
            subtitle="Quanto cada projeto rendeu de verdade, no ano"
            rows={pro ? byProject : DEMO_PROFIT}
          />
        </ProGate>
        <ProGate pro={pro}>
          <section className="h-full rounded-2xl border bg-card p-5 shadow-xs">
            <h2 className="font-bold">Quem paga atrasado</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Cobranças dos últimos 12 meses pagas depois do vencimento ou ainda vencidas
            </p>
            {late.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nenhum cliente com atraso. 👏</p>
            ) : (
              <ul className="grid gap-3 text-sm">
                {late.map((c) => (
                  <li key={c.clientId} className="flex items-start justify-between gap-3">
                    <Link href={`${APP_PATH}/clientes/${c.clientId}`} className="min-w-0 hover:underline">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.late} de {c.invoices} {c.invoices === 1 ? "cobrança" : "cobranças"} com atraso · média de {c.avgDaysLate}{" "}
                        {c.avgDaysLate === 1 ? "dia" : "dias"}
                      </span>
                    </Link>
                    {c.openLateCents > 0 ? (
                      <span className="shrink-0 font-semibold text-expense tabular">{formatMoney(c.openLateCents)} vencido</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </ProGate>
        <ProGate pro={pro}>
          <section className="h-full rounded-2xl border bg-card p-5 shadow-xs">
            <h2 className="font-bold">MEI: DAS e limite anual</h2>
            <p className="mb-4 text-xs text-muted-foreground">Previsão no ritmo atual de {year}</p>
            {mei.level !== "ok" && year === thisYear ? (
              <p
                role="alert"
                className={cn(
                  "mb-4 rounded-lg border px-3 py-2 text-sm font-medium",
                  mei.level === "atencao"
                    ? "border-warning/30 bg-warning/10 text-warning"
                    : "border-destructive/30 bg-destructive/10 text-destructive",
                )}
              >
                {mei.level === "passou"
                  ? "Você já passou do limite anual do MEI. Fale com seu contador sobre o desenquadramento."
                  : mei.level === "estoura"
                    ? `No ritmo atual, você passa do limite do MEI${mei.limitMonth ? ` por volta de ${monthLabel(`${year}-${String(mei.limitMonth).padStart(2, "0")}`)}` : ""}. Converse com seu contador.`
                    : "Atenção: a previsão do ano passa de 80% do limite do MEI."}
              </p>
            ) : null}
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Faturado no ano</dt>
                <dd className="mt-1 font-bold tabular">
                  {formatMoney(income)} <span className="font-normal text-muted-foreground">· {mei.usedPercent}%</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Previsão do ano</dt>
                <dd className="mt-1 font-bold tabular">
                  {formatMoney(mei.projectedIncome)} <span className="font-normal text-muted-foreground">· {mei.projectedPercent}%</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">DAS por mês</dt>
                <dd className="mt-1 font-bold tabular">{formatMoney(mei.dasMonthly)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">DAS que falta pagar no ano</dt>
                <dd className="mt-1 font-bold tabular">{formatMoney(year === thisYear ? mei.dasRemaining : 0)}</dd>
              </div>
            </dl>
            <Progress value={Math.min(mei.usedPercent, 100)} className="mt-4 h-2" aria-label={`Limite do MEI usado: ${mei.usedPercent}%`} />
            <p className="mt-2 text-xs text-muted-foreground">
              Limite de {formatMoney(mei.limit)}. Ajuste o limite e o valor do DAS em Configurações.
            </p>
          </section>
        </ProGate>
      </div>
    </>
  );
}

function ProfitTable({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: { id: string | null; label: string; income: number; expense: number; profit: number; margin: number | null }[];
}) {
  const shown = rows.length > 0 ? rows.slice(0, 10) : [];
  return (
    <section className="h-full rounded-2xl border bg-card p-5 shadow-xs">
      <h2 className="font-bold">{title}</h2>
      <p className="mb-4 text-xs text-muted-foreground">{subtitle}</p>
      {shown.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Ligue lançamentos a clientes e projetos para ver o lucro de cada um.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-medium">Nome</th>
              <th className="py-2 pr-2 text-right font-medium">Receitas</th>
              <th className="py-2 pr-2 text-right font-medium">Despesas</th>
              <th className="py-2 text-right font-medium">Lucro</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id ?? "none"} className="border-b last:border-0">
                <td className="max-w-[10rem] truncate py-2 pr-2">{r.label}</td>
                <td className="py-2 pr-2 text-right tabular text-income">{formatMoney(r.income)}</td>
                <td className="py-2 pr-2 text-right tabular text-expense">{formatMoney(r.expense)}</td>
                <td className="py-2 text-right font-semibold tabular">
                  {formatMoney(r.profit)}
                  {r.margin !== null ? <span className="block text-xs font-normal text-muted-foreground">{r.margin}%</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Breakdown({
  title,
  subtitle,
  rows,
  tone,
}: {
  title: string;
  subtitle: string;
  rows: { label: string; total: number }[];
  tone: "income" | "expense";
}) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <section className="h-full rounded-2xl border bg-card p-5 shadow-xs">
      <h2 className="font-bold">{title}</h2>
      <p className="mb-4 text-xs text-muted-foreground">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Sem lançamentos pagos neste ano.</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => {
            const percent = total > 0 ? (row.total / total) * 100 : 0;
            return (
              <li key={row.label} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span className="truncate">{row.label}</span>
                  <span className="shrink-0 font-semibold tabular">
                    {formatMoney(row.total)} <span className="font-normal text-muted-foreground">· {Math.round(percent)}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", tone === "income" ? "bg-income" : "bg-expense")}
                    style={{ width: `${Math.max(percent, 2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ProGate({ pro, children }: { pro: boolean; children: React.ReactNode }) {
  if (pro) return <>{children}</>;
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none blur-[5px] select-none">
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="max-w-xs rounded-2xl border bg-card/95 p-5 text-center shadow-lg">
          <span className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-[#c9ff3c] text-[#101c34]">
            <Lock className="size-4" />
          </span>
          <p className="font-bold">Relatório do plano Pro</p>
          <p className="mt-1 text-sm text-muted-foreground">Veja por categoria e por cliente de onde vem e para onde vai seu dinheiro.</p>
          <Button asChild size="sm" className="mt-3">
            <Link href={`${APP_PATH}/plano`}>
              <Sparkles /> Conhecer o Pro
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
