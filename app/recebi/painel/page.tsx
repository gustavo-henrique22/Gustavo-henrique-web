import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  FileSignature,
  Landmark,
  PiggyBank,
  Target,
  Wallet,
  WandSparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CashflowChart } from "@/components/recebi/cashflow-chart";
import { MonthSwitcher } from "@/components/recebi/month-switcher";
import { PageHeader } from "@/components/recebi/page-header";
import { ForecastCard } from "@/components/recebi/forecast-card";
import { OnboardingChecklist, onboardingSteps } from "@/components/recebi/onboarding-checklist";
import { QuickChargeButton } from "@/components/recebi/quick-charge";
import { StatCard } from "@/components/recebi/stat-card";
import { NewTransactionButton } from "@/components/recebi/transaction-dialogs";
import { aiEnabled } from "@/lib/recebi/ai";
import { emailEnabled } from "@/lib/recebi/email";
import { requireUser } from "@/lib/recebi/auth";
import { cashForecast } from "@/lib/recebi/forecast";
import { APP_PATH } from "@/lib/recebi/config";
import {
  agenda,
  hasAnyData,
  incomeByClient,
  listClients,
  listProjects,
  monthlySeries,
  monthTotals,
  openPayables,
  onboardingSnapshot,
  openReceivables,
  paidIncomeBetween,
} from "@/lib/recebi/data";
import { currentMonth, formatDateShort, isValidMonth, monthBounds, monthLabel, monthShortLabel, todayISO } from "@/lib/recebi/dates";
import { formatMoney, formatPercentBp } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Visão geral" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ mes?: string; "bem-vindo"?: string; "somente-leitura"?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const month = isValidMonth(params.mes) ? params.mes : currentMonth();
  const year = month.slice(0, 4);
  const today = todayISO();

  const [totals, series, receivables, payables, upcoming, clientsList, projectRows, topClients, yearIncome, anyData, forecast, onboarding] =
    await Promise.all([
      monthTotals(user.id, month),
      monthlySeries(user.id, month, 6),
      openReceivables(user.id),
      openPayables(user.id),
      agenda(user.id, 7),
      listClients(user.id),
      listProjects(user.id),
      incomeByClient(user.id, `${year}-01-01`, `${year}-12-31`, 5),
      paidIncomeBetween(user.id, `${year}-01-01`, `${year}-12-31`),
      hasAnyData(user.id),
      cashForecast(user.id),
      onboardingSnapshot(user.id),
    ]);

  const projects = projectRows.map((r) => r.project);
  const profit = totals.incomePaid - totals.expensePaid;
  const taxEstimate = Math.round((totals.incomePaid * user.taxRateBp) / 10_000);
  const freeCash = profit - taxEstimate;
  const goalPercent = user.monthlyGoalCents > 0 ? Math.round((totals.incomePaid / user.monthlyGoalCents) * 100) : null;
  const limitPercent = user.annualLimitCents > 0 ? Math.round((yearIncome / user.annualLimitCents) * 100) : null;
  const firstName = (user.actorName ?? user.name).trim().split(/\s+/)[0];
  const previous = series[series.length - 2];
  const prevLabel = `vs ${monthShortLabel(previous.month).split("/")[0]}`;
  const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const monthIsPast = monthBounds(month).end < today;

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={`Resumo de ${monthLabel(month)}`}
        actions={
          <>
            <MonthSwitcher month={month} basePath={APP_PATH} />
          </>
        }
      />
      {params["somente-leitura"] ? (
        <p role="alert" className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-medium text-warning">
          Seu acesso a esta conta é só de leitura. Peça ao dono para mudar seu papel para Editor.
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <NewTransactionButton type="receita" clients={clientsList} projects={projects} label="Nova receita" />
        <NewTransactionButton type="despesa" clients={clientsList} projects={projects} label="Nova despesa" />
        <Button asChild variant="outline">
          <Link href={`${APP_PATH}/orcamentos/novo`}>
            <FileSignature /> Novo orçamento
          </Link>
        </Button>
        <QuickChargeButton clients={clientsList} />
      </div>

      {anyData && aiEnabled() ? (
        <form
          action={`${APP_PATH}/assistente`}
          method="get"
          className="mb-6 flex items-center gap-2 rounded-2xl border bg-card p-1.5 pl-4 shadow-xs focus-within:ring-2 focus-within:ring-[#c9ff3c]"
        >
          <WandSparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <label htmlFor="ask" className="sr-only">
            Pergunte ao assistente
          </label>
          <input
            id="ask"
            name="q"
            required
            maxLength={500}
            autoComplete="off"
            placeholder="Pergunte ao assistente: “quanto posso gastar este mês?”"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="sm">
            Perguntar
          </Button>
        </form>
      ) : null}

      {!user.isDemo && !user.onboardingDismissedAt ? (
        <OnboardingChecklist steps={onboardingSteps(user, onboarding, emailEnabled())} welcome={params["bem-vindo"] === "1"} />
      ) : null}

      <section aria-label="Resumo do mês" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Recebido"
          value={formatMoney(totals.incomePaid)}
          icon={<ArrowUpRight />}
          tone="income"
          delta={{ percent: change(totals.incomePaid, previous.income), positiveIsGood: true, label: prevLabel }}
          hint={totals.incomePending > 0 ? `+ ${formatMoney(totals.incomePending)} a receber no mês` : "Receitas pagas no mês"}
        />
        <StatCard
          label="Gasto"
          value={formatMoney(totals.expensePaid)}
          icon={<ArrowDownRight />}
          tone="expense"
          delta={{ percent: change(totals.expensePaid, previous.expense), positiveIsGood: false, label: prevLabel }}
          hint={totals.expensePending > 0 ? `+ ${formatMoney(totals.expensePending)} a pagar no mês` : "Despesas pagas no mês"}
        />
        <StatCard
          label="Lucro do mês"
          value={formatMoney(profit)}
          icon={<Wallet />}
          tone="brand"
          delta={{ percent: change(profit, previous.profit), positiveIsGood: true, label: prevLabel }}
          hint={`Imposto estimado (${formatPercentBp(user.taxRateBp)}): ${formatMoney(taxEstimate)}`}
        />
        <StatCard
          label="Sobra livre"
          value={formatMoney(freeCash)}
          icon={<PiggyBank />}
          hint="Lucro menos o imposto estimado. É o que você pode retirar com segurança."
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border bg-card p-5 shadow-xs lg:col-span-2" aria-labelledby="fluxo-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 id="fluxo-title" className="font-bold">
                Fluxo de caixa
              </h2>
              <p className="text-xs text-muted-foreground">Valores pagos nos últimos 6 meses</p>
            </div>
            <Link href={`${APP_PATH}/relatorios?ano=${year}`} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
              Ver relatórios →
            </Link>
          </div>
          <CashflowChart data={series} />
        </section>

        <div className="grid gap-4">
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <CircleDollarSign className="size-4 text-income" /> A receber
              </h2>
              <span className="text-lg font-extrabold tabular">{formatMoney(receivables.total)}</span>
            </div>
            {receivables.overdue > 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3.5" /> {formatMoney(receivables.overdue)} em atraso
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Nada em atraso. Ótimo!</p>
            )}
            <div className="my-4 h-px bg-border" />
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <Landmark className="size-4 text-expense" /> A pagar
              </h2>
              <span className="text-lg font-extrabold tabular">{formatMoney(payables.total)}</span>
            </div>
            {payables.overdue > 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3.5" /> {formatMoney(payables.overdue)} vencido
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h2 className="flex items-center gap-2 font-bold">
              <Target className="size-4" /> Meta do mês
            </h2>
            {goalPercent !== null ? (
              <>
                <p className="mt-3 text-sm">
                  <span className="text-lg font-extrabold tabular">{formatMoney(totals.incomePaid)}</span>{" "}
                  <span className="text-muted-foreground">de {formatMoney(user.monthlyGoalCents)}</span>
                </p>
                <Progress
                  value={Math.min(goalPercent, 100)}
                  className="mt-3 h-2.5 bg-muted [&>div]:bg-income"
                  aria-label="Progresso da meta"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {goalPercent >= 100
                    ? "Meta batida! 🎉"
                    : monthIsPast
                      ? `Você chegou a ${goalPercent}% da meta.`
                      : `${goalPercent}% — faltam ${formatMoney(user.monthlyGoalCents - totals.incomePaid)}`}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Defina quanto quer faturar por mês em{" "}
                <Link href={`${APP_PATH}/configuracoes`} className="font-semibold text-foreground underline underline-offset-2">
                  Configurações
                </Link>
                .
              </p>
            )}
          </section>
        </div>
      </div>

      {anyData ? (
        <div className="mt-4">
          <ForecastCard months={forecast.months} avgIncome={forecast.avgIncome} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border bg-card p-5 shadow-xs lg:col-span-2" aria-labelledby="agenda-title">
          <h2 id="agenda-title" className="mb-3 flex items-center gap-2 font-bold">
            <CalendarClock className="size-4" /> Próximos vencimentos
          </h2>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma conta ou cobrança em aberto.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((item) => {
                const late = item.date < today;
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link href={item.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60">
                      <span
                        className={cn(
                          "grid w-12 shrink-0 place-items-center rounded-lg border py-1 text-center text-[0.7rem] font-bold leading-tight uppercase",
                          late && "border-destructive/40 bg-destructive/10 text-destructive",
                        )}
                      >
                        {formatDateShort(item.date)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {late ? "Atrasado · " : ""}
                          {item.kind === "despesa" ? "A pagar" : item.kind === "cobranca" ? "Cobrança enviada" : "A receber"}
                          {item.subtitle ? ` · ${item.subtitle}` : ""}
                        </span>
                      </span>
                      <span className={cn("text-sm font-bold tabular", item.kind === "despesa" ? "text-expense" : "text-income")}>
                        {item.kind === "despesa" ? "−" : "+"} {formatMoney(item.amountCents)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="grid gap-4">
          <section className="rounded-2xl border bg-card p-5 shadow-xs" aria-labelledby="clientes-title">
            <h2 id="clientes-title" className="mb-3 font-bold">
              Melhores clientes de {year}
            </h2>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Associe receitas a clientes para ver quem mais te paga.</p>
            ) : (
              <ol className="grid gap-3">
                {topClients.map((c, i) => (
                  <li key={c.clientId ?? "sem"} className="flex items-center gap-3 text-sm">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{c.name ?? "Sem cliente"}</span>
                    <span className="font-semibold tabular">{formatMoney(c.total)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {limitPercent !== null ? (
            <section className="rounded-2xl border bg-card p-5 shadow-xs">
              <h2 className="font-bold">Faturamento em {year}</h2>
              <p className="mt-1 text-xs text-muted-foreground">Limite anual configurado: {formatMoney(user.annualLimitCents)}</p>
              <Progress
                value={Math.min(limitPercent, 100)}
                className={cn("mt-3 h-2.5 bg-muted", limitPercent >= 80 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")}
                aria-label="Uso do limite anual"
              />
              <p className="mt-2 text-xs">
                <span className="font-semibold tabular">{formatMoney(yearIncome)}</span>{" "}
                <span className="text-muted-foreground">({limitPercent}% do limite)</span>
              </p>
              {limitPercent >= 80 ? (
                <p className="mt-2 text-xs font-medium text-destructive">Atenção: você está perto do limite. Converse com seu contador.</p>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
