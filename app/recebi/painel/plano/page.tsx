import { Check, CheckCircle2, Clock, CreditCard, MessageCircle, Sparkles, TriangleAlert, X } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/recebi/page-header";
import { SubmitButton } from "@/components/recebi/submit-button";
import { startCheckout } from "@/lib/recebi/actions/billing";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { billingEnabled, processPayment } from "@/lib/recebi/billing";
import { FREE_LIMITS, PRO_PRICE_CENTS, PRO_YEARLY_PRICE_CENTS, whatsappLink } from "@/lib/recebi/config";
import { countActiveClients, countInvoicesInMonth, countQuotesInMonth, getUserById } from "@/lib/recebi/data";
import { currentMonth, formatDate } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plano" };
export const dynamic = "force-dynamic";

const FEATURES: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Receitas e despesas", free: "Ilimitadas", pro: "Ilimitadas" },
  { label: "Clientes ativos", free: `Até ${FREE_LIMITS.clients}`, pro: "Ilimitados" },
  { label: "Orçamentos com aprovação online", free: `${FREE_LIMITS.quotesPerMonth} por mês`, pro: "Ilimitados" },
  { label: "Cobranças com link e Pix", free: `${FREE_LIMITS.invoicesPerMonth} por mês`, pro: "Ilimitadas" },
  { label: "Recibos, calculadora de preço e app no celular", free: true, pro: true },
  { label: "Exportar para Excel (CSV)", free: true, pro: true },
  { label: "Relatórios por categoria e por cliente", free: false, pro: true },
  { label: "Lembretes automáticos de cobrança por e-mail", free: false, pro: true },
  { label: "Comprovantes anexados às despesas", free: false, pro: true },
  { label: "Sua logo nas cobranças, orçamentos e recibos", free: false, pro: true },
  { label: "Sem a marca Recebi nos documentos", free: false, pro: true },
  { label: "Suporte prioritário pelo WhatsApp", free: false, pro: true },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto size-4 text-income" aria-label="Incluído" />;
  if (value === false) return <X className="mx-auto size-4 text-muted-foreground/60" aria-label="Não incluído" />;
  return <span className="text-sm">{value}</span>;
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ pagamento?: string; payment_id?: string }> }) {
  const user = await requireUser();
  const { pagamento, payment_id } = await searchParams;

  // Ao voltar do Mercado Pago, confere o pagamento na hora (o webhook também faz isso).
  const result = payment_id && billingEnabled() ? await processPayment(payment_id, user.id) : null;
  // O usuário desta requisição ainda tem o plano antigo; buscamos de novo depois de ativar.
  const fresh = result === "ativado" || result === "ja-processado" ? ((await getUserById(user.id)) ?? user) : user;
  const pro = hasPro(fresh);

  const [clients, invoices, quotes] = await Promise.all([
    countActiveClients(user.id),
    countInvoicesInMonth(user.id, currentMonth()),
    countQuotesInMonth(user.id, currentMonth()),
  ]);
  const online = billingEnabled() && !user.isDemo;
  const message = `Olá! Quero ${pro ? "renovar" : "assinar"} o plano Pro do Recebi. Meu e-mail de cadastro é ${user.email}.`;

  return (
    <>
      <PageHeader title="Seu plano" description="Comece grátis e mude para o Pro quando seu negócio pedir." />

      {result === "ativado" || result === "ja-processado" ? (
        <Banner tone="ok" icon={<CheckCircle2 className="size-5" />}>
          Pagamento aprovado! Seu Pro está ativo até {formatDate(fresh.planExpiresAt)}. Obrigado pela confiança. ✨
        </Banner>
      ) : pagamento === "pendente" || result === "pendente" ? (
        <Banner tone="wait" icon={<Clock className="size-5" />}>
          Pagamento em processamento. Assim que o Mercado Pago confirmar, o Pro é liberado automaticamente.
        </Banner>
      ) : pagamento === "falhou" || pagamento === "erro" ? (
        <Banner tone="error" icon={<TriangleAlert className="size-5" />}>
          Não foi possível concluir o pagamento. Tente de novo ou fale com a gente pelo WhatsApp.
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
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
              {fresh.planExpiresAt ? `Válido até ${formatDate(fresh.planExpiresAt)}.` : "Sem data de expiração."} Obrigado por apoiar o
              Recebi!
            </p>
          ) : (
            <dl className="mt-5 grid gap-4 text-sm">
              <Usage label="Clientes ativos" used={clients} limit={FREE_LIMITS.clients} />
              <Usage label="Orçamentos este mês" used={quotes} limit={FREE_LIMITS.quotesPerMonth} />
              <Usage label="Cobranças este mês" used={invoices} limit={FREE_LIMITS.invoicesPerMonth} />
            </dl>
          )}
        </section>

        <section className="relative overflow-hidden rounded-2xl bg-[#101c34] p-6 text-white shadow-lg">
          <div aria-hidden className="absolute -top-20 -right-20 size-64 rounded-full border border-[#c9ff3c]/25" />
          <div aria-hidden className="absolute -right-6 -bottom-24 size-48 rounded-full bg-[#c9ff3c]/10 blur-2xl" />
          <p className="relative text-xs font-bold tracking-[0.16em] text-[#c9ff3c] uppercase">Recebi Pro</p>
          <p className="relative mt-2 text-sm text-white/70">
            Tudo ilimitado, lembretes automáticos, comprovantes e sua marca nos documentos.
          </p>

          <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
            <PlanOption
              plan="mensal"
              title="Mensal"
              price={formatMoney(PRO_PRICE_CENTS)}
              period="/mês"
              note="Cancele quando quiser"
              online={online}
              whatsapp={whatsappLink(message + " (mensal)")}
              renew={pro}
            />
            <PlanOption
              plan="anual"
              title="Anual"
              price={formatMoney(PRO_YEARLY_PRICE_CENTS)}
              period="/ano"
              note={`2 meses grátis · ${formatMoney(Math.round(PRO_YEARLY_PRICE_CENTS / 12))}/mês`}
              online={online}
              whatsapp={whatsappLink(message + " (anual)")}
              renew={pro}
              highlight
            />
          </div>
          <p className="relative mt-4 flex items-center gap-1.5 text-xs text-white/60">
            {online ? (
              <>
                <CreditCard className="size-3.5" /> Pagamento seguro pelo Mercado Pago: Pix, cartão ou boleto. Liberação automática.
              </>
            ) : (
              <>
                <MessageCircle className="size-3.5" /> Pagamento via Pix pelo WhatsApp. O Pro é liberado em até 24 horas.
              </>
            )}
          </p>
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

function Banner({ tone, icon, children }: { tone: "ok" | "wait" | "error"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium",
        tone === "ok" && "border-income/30 bg-income/10 text-income",
        tone === "wait" && "border-warning/30 bg-warning/10 text-warning",
        tone === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {icon}
      {children}
    </p>
  );
}

function PlanOption({
  plan,
  title,
  price,
  period,
  note,
  online,
  whatsapp,
  renew,
  highlight,
}: {
  plan: "mensal" | "anual";
  title: string;
  price: string;
  period: string;
  note: string;
  online: boolean;
  whatsapp: string;
  renew: boolean;
  highlight?: boolean;
}) {
  const label = renew ? "Renovar" : "Assinar";
  return (
    <div
      className={cn("flex flex-col rounded-xl border p-4", highlight ? "border-[#c9ff3c] bg-[#c9ff3c]/10" : "border-white/15 bg-white/5")}
    >
      <div className="flex items-center justify-between">
        <p className="font-bold">{title}</p>
        {highlight ? (
          <span className="rounded-full bg-[#c9ff3c] px-2 py-0.5 text-[0.65rem] font-bold text-[#101c34]">Melhor preço</span>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-extrabold tabular">
        {price}
        <span className="text-sm font-medium text-white/60">{period}</span>
      </p>
      <p className="mt-1 text-xs text-white/60">{note}</p>
      {online ? (
        <form action={startCheckout} className="mt-4">
          <input type="hidden" name="plan" value={plan} />
          <SubmitButton className="w-full bg-[#c9ff3c] text-[#101c34] hover:bg-[#c9ff3c]/90" pendingLabel="Abrindo pagamento…">
            {label} {title.toLowerCase()}
          </SubmitButton>
        </form>
      ) : (
        <Button asChild className="mt-4 w-full bg-[#c9ff3c] text-[#101c34] hover:bg-[#c9ff3c]/90">
          <a href={whatsapp} target="_blank" rel="noreferrer">
            <MessageCircle /> {label} pelo WhatsApp
          </a>
        </Button>
      )}
    </div>
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
