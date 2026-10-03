"use client";

import { Clock, Coins, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, parseMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

export type CalculatorDefaults = {
  desiredCents: number;
  costsCents: number;
  taxPercent: number;
};

const num = (value: string, fallback = 0) => {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

function Field({
  id,
  label,
  hint,
  suffix,
  prefix,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  suffix?: string;
  prefix?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>
        ) : null}
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("tabular", prefix && "pl-9", suffix && "pr-16")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Calculadora de preço por hora para freelancers. */
export function PriceCalculator({ defaults }: { defaults: CalculatorDefaults }) {
  const [desired, setDesired] = useState((defaults.desiredCents / 100).toLocaleString("pt-BR"));
  const [costs, setCosts] = useState((defaults.costsCents / 100).toLocaleString("pt-BR"));
  const [tax, setTax] = useState(String(defaults.taxPercent).replace(".", ","));
  const [reserve, setReserve] = useState("15");
  const [hoursPerDay, setHoursPerDay] = useState("6");
  const [daysPerWeek, setDaysPerWeek] = useState("5");
  const [vacationWeeks, setVacationWeeks] = useState("4");
  const [projectHours, setProjectHours] = useState("20");

  const result = useMemo(() => {
    const desiredCents = parseMoney(desired) ?? 0;
    const costsCents = parseMoney(costs) ?? 0;
    const taxRate = Math.min(Math.max(num(tax) / 100, 0), 0.6);
    const reserveRate = Math.min(Math.max(num(reserve) / 100, 0), 1);
    const hours = Math.min(Math.max(num(hoursPerDay), 0), 16);
    const days = Math.min(Math.max(num(daysPerWeek), 0), 7);
    const weeks = Math.min(Math.max(52 - num(vacationWeeks), 0), 52);

    const beforeTax = (desiredCents + costsCents) * (1 + reserveRate);
    const revenue = taxRate < 1 ? beforeTax / (1 - taxRate) : 0;
    const billableHours = (hours * days * weeks) / 12;
    const hourly = billableHours > 0 ? revenue / billableHours : 0;
    return {
      revenue: Math.round(revenue),
      billableHours: Math.round(billableHours),
      hourly: Math.round(hourly),
      daily: Math.round(hourly * hours),
      project: Math.round(hourly * Math.max(num(projectHours), 0)),
      parts: [
        { label: "Seu salário", value: desiredCents, color: "bg-income" },
        { label: "Custos do trabalho", value: costsCents, color: "bg-chart-4" },
        { label: "Reserva", value: Math.round((desiredCents + costsCents) * reserveRate), color: "bg-[#c9a227]" },
        { label: "Impostos", value: Math.round(revenue * taxRate), color: "bg-expense" },
      ],
    };
  }, [desired, costs, tax, reserve, hoursPerDay, daysPerWeek, vacationWeeks, projectHours]);

  const total = result.parts.reduce((sum, part) => sum + part.value, 0) || 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
      <section className="grid content-start gap-5 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <div>
          <h2 className="font-bold">Quanto você quer ganhar</h2>
          <p className="text-xs text-muted-foreground">Pense no valor que precisa sobrar no seu bolso todo mês.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="desired" label="Salário desejado por mês" prefix="R$" value={desired} onChange={setDesired} />
          <Field
            id="costs"
            label="Custos do trabalho por mês"
            prefix="R$"
            hint="Software, internet, equipamento, contador…"
            value={costs}
            onChange={setCosts}
          />
          <Field id="tax" label="Impostos" suffix="% do valor" value={tax} onChange={setTax} />
          <Field
            id="reserve"
            label="Reserva de segurança"
            suffix="%"
            hint="Para meses fracos, férias e imprevistos."
            value={reserve}
            onChange={setReserve}
          />
        </div>
        <div className="h-px bg-border" />
        <div>
          <h2 className="font-bold">Sua rotina</h2>
          <p className="text-xs text-muted-foreground">Conte só as horas que você consegue cobrar de clientes.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="hoursPerDay" label="Horas cobráveis por dia" value={hoursPerDay} onChange={setHoursPerDay} />
          <Field id="daysPerWeek" label="Dias por semana" value={daysPerWeek} onChange={setDaysPerWeek} />
          <Field id="vacation" label="Semanas de folga no ano" value={vacationWeeks} onChange={setVacationWeeks} />
        </div>
      </section>

      <section className="grid content-start gap-4" aria-live="polite">
        <div className="relative overflow-hidden rounded-2xl bg-[#101c34] p-6 text-white shadow-lg">
          <div aria-hidden className="absolute -top-16 -right-16 size-56 rounded-full border border-[#c9ff3c]/20" />
          <p className="relative flex items-center gap-2 text-sm text-white/70">
            <Clock className="size-4" /> Seu valor por hora
          </p>
          <p className="relative mt-1 text-5xl font-black tracking-tight text-[#c9ff3c] tabular">{formatMoney(result.hourly)}</p>
          <div className="relative mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/60">Diária ({hoursPerDay || 0}h)</p>
              <p className="text-lg font-bold tabular">{formatMoney(result.daily)}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/60">Faturamento mensal</p>
              <p className="text-lg font-bold tabular">{formatMoney(result.revenue)}</p>
            </div>
          </div>
          <p className="relative mt-3 text-xs text-white/60">Com cerca de {result.billableHours} horas cobráveis por mês.</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <h3 className="font-bold">Para onde vai o valor que você cobra</h3>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
            {result.parts.map((part) => (
              <span key={part.label} className={part.color} style={{ width: `${(part.value / total) * 100}%` }} title={part.label} />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {result.parts.map((part) => (
              <li key={part.label} className="flex items-center gap-2">
                <span className={cn("size-2.5 shrink-0 rounded-sm", part.color)} />
                <span className="text-muted-foreground">{part.label}</span>
                <span className="ml-auto font-semibold tabular">{formatMoney(part.value)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <h3 className="flex items-center gap-2 font-bold">
            <Coins className="size-4" /> Preço de um projeto
          </h3>
          <div className="mt-3 flex items-end gap-3">
            <div className="w-32">
              <Field id="projectHours" label="Horas estimadas" value={projectHours} onChange={setProjectHours} />
            </div>
            <p className="pb-1 text-2xl font-extrabold tabular">{formatMoney(result.project)}</p>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" /> Dica: some 20% às horas estimadas para reuniões, revisões e ajustes.
          </p>
        </div>
      </section>
    </div>
  );
}
