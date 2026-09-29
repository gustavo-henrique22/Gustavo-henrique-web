import { Check, MessageCircle, Sparkles, X } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/recebi/page-header";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { FREE_LIMITS, PRO_PRICE_CENTS, whatsappLink } from "@/lib/recebi/config";
import { countActiveClients, countInvoicesInMonth } from "@/lib/recebi/data";
import { currentMonth, formatDate } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";

export const metadata: Metadata = { title: "Plano" };

const FEATURES: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Receitas e despesas", free: "Ilimitadas", pro: "Ilimitadas" },
  { label: "Clientes ativos", free: `Até ${FREE_LIMITS.clients}`, pro: "Ilimitados" },
  { label: "Cobranças com link e Pix", free: `${FREE_LIMITS.invoicesPerMonth} por mês`, pro: "Ilimitadas" },
  { label: "Painel, metas e imposto estimado", free: true, pro: true },
  { label: "Exportar para Excel (CSV)", free: true, pro: true },
  { label: "Relatórios por categoria e por cliente", free: false, pro: true },
  { label: "Cobranças sem a marca Recebi", free: false, pro: true },
  { label: "Suporte prioritário pelo WhatsApp", free: false, pro: true },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto size-4 text-income" aria-label="Incluído" />;
  if (value === false) return <X className="mx-auto size-4 text-muted-foreground/60" aria-label="Não incluído" />;
  return <span className="text-sm">{value}</span>;
}

export default async function PlanPage() {
  const user = await requireUser();
  const pro = hasPro(user);
  const [clients, invoices] = await Promise.all([countActiveClients(user.id), countInvoicesInMonth(user.id, currentMonth())]);
  const message = pro
    ? `Olá! Quero renovar meu plano Pro do Recebi. Meu e-mail de cadastro é ${user.email}.`
    : `Olá! Quero assinar o plano Pro do Recebi (${formatMoney(PRO_PRICE_CENTS)}/mês). Meu e-mail de cadastro é ${user.email}.`;

  return (
    <>
      <PageHeader title="Seu plano" description="Comece grátis e mude para o Pro quando seu negócio pedir." />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-2xl border bg-card p-6 shadow-xs">
          <p className="text-sm text-muted-foreground">Plano atual</p>
          <p className="mt-1 flex items-center gap-2 text-3xl font-extrabold">
            {pro ? (
              <>
                Pro <Sparkles className="size-6 text-[#9bd100] dark:text-brand" />
              </>
            ) : (
              "Grátis"
            )}
          </p>
          {pro ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {user.planExpiresAt ? `Válido até ${formatDate(user.planExpiresAt)}.` : "Sem data de expiração."} Obrigado por apoiar o
              Recebi!
            </p>
          ) : (
            <dl className="mt-5 grid gap-4 text-sm">
              <Usage label="Clientes ativos" used={clients} limit={FREE_LIMITS.clients} />
              <Usage label="Cobranças este mês" used={invoices} limit={FREE_LIMITS.invoicesPerMonth} />
            </dl>
          )}
        </section>

        <section className="relative overflow-hidden rounded-2xl bg-[#101c34] p-6 text-white shadow-lg">
          <div aria-hidden className="absolute -top-20 -right-20 size-64 rounded-full border border-[#c9ff3c]/25" />
          <p className="relative text-xs font-bold tracking-[0.16em] text-[#c9ff3c] uppercase">Recebi Pro</p>
          <p className="relative mt-2 text-4xl font-extrabold">
            {formatMoney(PRO_PRICE_CENTS)}
            <span className="text-base font-medium text-white/60">/mês</span>
          </p>
          <p className="relative mt-2 text-sm text-white/70">Menos que um café por semana para ter o controle completo do seu dinheiro.</p>
          <Button asChild size="lg" className="relative mt-5 w-full bg-[#c9ff3c] text-[#101c34] hover:bg-[#c9ff3c]/90 sm:w-auto">
            <a href={whatsappLink(message)} target="_blank" rel="noreferrer">
              <MessageCircle /> {pro ? "Renovar pelo WhatsApp" : "Assinar pelo WhatsApp"}
            </a>
          </Button>
          <p className="relative mt-3 text-xs text-white/60">Pagamento via Pix. O Pro é liberado na sua conta em até 24 horas.</p>
        </section>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-5 py-3 text-left font-semibold">Recurso</th>
              <th className="w-28 px-3 py-3 text-center font-semibold sm:w-40">Grátis</th>
              <th className="w-28 px-3 py-3 text-center font-semibold sm:w-40">Pro</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.label} className="border-b last:border-0">
                <td className="px-5 py-3">{f.label}</td>
                <td className="px-3 py-3 text-center text-muted-foreground">
                  <Cell value={f.free} />
                </td>
                <td className="px-3 py-3 text-center font-medium">
                  <Cell value={f.pro} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="font-semibold tabular">
          {used} de {limit}
        </dd>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${percent >= 100 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
