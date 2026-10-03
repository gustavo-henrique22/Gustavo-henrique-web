import { CircleCheck, CircleDashed, Search } from "lucide-react";
import type { Metadata } from "next";
import { and, desc, eq, like, or } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ActionButton } from "@/components/recebi/action-button";
import { ActionForm } from "@/components/recebi/action-form";
import { AdminResetLink } from "@/components/recebi/admin-reset-link";
import { PageHeader } from "@/components/recebi/page-header";
import { MiniBars } from "@/components/recebi/mini-bars";
import { StatCard } from "@/components/recebi/stat-card";
import { getDb } from "@/db";
import { payments, users } from "@/db/schema";
import { adminAssignPayment, setUserPlan } from "@/lib/recebi/actions/admin";
import { businessMetrics } from "@/lib/recebi/admin-metrics";
import { aiEnabled } from "@/lib/recebi/ai";
import { hasPro, requireAdmin } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { formatDate } from "@/lib/recebi/dates";
import { billingEnabled } from "@/lib/recebi/billing";
import { emailEnabled, readEnv } from "@/lib/recebi/email";
import { encryptionEnabled } from "@/lib/recebi/encryption";
import { externalCheckoutEnabled, unmatchedPayments } from "@/lib/recebi/external-billing";
import { siteUrlConfigured } from "@/lib/recebi/origin";
import { filesEnabled } from "@/lib/recebi/files";
import { googleEnabled } from "@/lib/recebi/google";
import { formatMoney } from "@/lib/recebi/money";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = (await searchParams).q?.trim().slice(0, 100) ?? "";
  const db = getDb();
  const term = `%${q.replace(/[%_]/g, "")}%`;

  const [list, recentPayments, metrics, unmatched] = await Promise.all([
    db
      .select()
      .from(users)
      .where(q ? and(eq(users.isDemo, false), or(like(users.email, term), like(users.name, term))) : eq(users.isDemo, false))
      .orderBy(desc(users.createdAt))
      .limit(100),
    db
      .select({ payment: payments, email: users.email })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.userId))
      .orderBy(desc(payments.createdAt))
      .limit(10),
    businessMetrics(),
    unmatchedPayments(),
  ]);

  const integrations = [
    { name: "Envio de e-mails (Resend)", on: emailEnabled(), how: "RESEND_API_KEY e RECEBI_EMAIL_FROM" },
    {
      name: "Venda do Pro por link (Kiwify ou Shopify)",
      on: externalCheckoutEnabled(),
      how: "RECEBI_CHECKOUT_MENSAL_URL e RECEBI_CHECKOUT_ANUAL_URL",
    },
    {
      name: "Liberação automática pela Kiwify",
      on: !!readEnv("KIWIFY_WEBHOOK_TOKEN"),
      how: "KIWIFY_WEBHOOK_TOKEN + webhook para /recebi/api/pagamentos/kiwify",
    },
    {
      name: "Liberação automática pela Shopify",
      on: !!readEnv("SHOPIFY_WEBHOOK_SECRET"),
      how: "SHOPIFY_WEBHOOK_SECRET + webhook para /recebi/api/pagamentos/shopify",
    },
    {
      name: "Venda pelo Mercado Pago (alternativa)",
      on: billingEnabled(),
      how: "MERCADOPAGO_ACCESS_TOKEN (e MERCADOPAGO_WEBHOOK_SECRET)",
    },
    {
      name: "Endereço oficial do site",
      on: siteUrlConfigured(),
      how: "RECEBI_SITE_URL (ex.: https://seusite.com) — usado nos links dos e-mails; recomendado por segurança",
    },
    {
      name: "Criptografia dos dados sensíveis",
      on: encryptionEnabled(),
      how: "RECEBI_ENCRYPTION_KEY com 32+ caracteres aleatórios (guarde uma cópia em local seguro)",
    },
    { name: "Login com Google", on: googleEnabled(), how: "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET" },
    { name: "Assistente e orçamentos com IA (Claude)", on: aiEnabled(), how: "ANTHROPIC_API_KEY (crie em console.anthropic.com)" },
    { name: "Comprovantes e logos (R2)", on: filesEnabled(), how: "binding FILES em .openai/hosting.json" },
    {
      name: "Lembretes diários de cobrança",
      on: !!readEnv("RECEBI_CRON_SECRET") && emailEnabled(),
      how: "RECEBI_CRON_SECRET + agendador chamando /recebi/api/lembretes",
    },
  ];

  return (
    <>
      <PageHeader title="Administração" description="Números do negócio, usuários, pagamentos e integrações do Recebi." />

      <section aria-labelledby="numeros" className="grid gap-4">
        <h2 id="numeros" className="sr-only">
          Números do negócio
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Receita recorrente (MRR)"
            value={formatMoney(metrics.pro.mrr)}
            tone="brand"
            hint={`${metrics.pro.paying} pagantes · ${formatMoney(metrics.pro.mrr * 12)} por ano`}
          />
          <StatCard
            label="Recebido este mês"
            value={formatMoney(metrics.revenue.month)}
            tone="income"
            hint={`Últimos 30 dias: ${formatMoney(metrics.revenue.last30)} · total ${formatMoney(metrics.revenue.total)}`}
          />
          <StatCard
            label="Usuários"
            value={metrics.users.total.toLocaleString("pt-BR")}
            delta={{
              percent:
                metrics.users.prev30 > 0 ? Math.round(((metrics.users.new30 - metrics.users.prev30) / metrics.users.prev30) * 100) : null,
              positiveIsGood: true,
              label: "novos vs 30 dias antes",
            }}
            hint={`${metrics.users.new7} novos em 7 dias · ${metrics.users.new30} em 30 dias`}
          />
          <StatCard
            label="Assinantes Pro"
            value={metrics.pro.active.toLocaleString("pt-BR")}
            hint={`Conversão ${metrics.pro.conversion}% · ${metrics.pro.churned30} venceram em 30 dias`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h3 className="font-bold">Cadastros por dia</h3>
            <p className="mb-6 text-xs text-muted-foreground">Últimos 30 dias, sem contas de demonstração</p>
            <MiniBars
              data={metrics.signups}
              caption="Cadastros por dia nos últimos 30 dias"
              labelEvery={7}
              emptyText="Nenhum cadastro nos últimos 30 dias"
            />
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h3 className="font-bold">Receita do Pro por mês</h3>
            <p className="mb-6 text-xs text-muted-foreground">Pagamentos confirmados, últimos 6 meses</p>
            <MiniBars
              data={metrics.revenueByMonth}
              kind="money"
              caption="Receita do plano Pro por mês"
              emptyText="Nenhum pagamento do Pro ainda"
            />
          </section>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Ativos" value={`${metrics.users.active7} · ${metrics.users.active30}`} hint="Entraram nos últimos 7 · 30 dias" />
          <StatCard
            label="Cobrado pelos usuários"
            value={formatMoney(metrics.usage.volumePaid30)}
            hint={`${metrics.usage.invoicesPaid30} cobranças pagas em 30 dias`}
          />
          <StatCard
            label="Indicações"
            value={metrics.referrals.referred.toLocaleString("pt-BR")}
            hint={`${metrics.referrals.rewards} viraram assinantes · ${metrics.referrals.months} meses de Pro dados`}
          />
          <StatCard
            label="Ticket médio"
            value={formatMoney(metrics.revenue.avgTicket)}
            hint={`${metrics.revenue.payments} pagamentos no total`}
          />
        </div>

        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h3 className="mb-4 font-bold">Uso dos recursos</h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Chave Pix cadastrada", metrics.adoption.pix],
              ["E-mail confirmado", metrics.adoption.verified],
              ["Página pública no ar", metrics.adoption.page],
              ["Verificação em 2 etapas", metrics.adoption.twoFactor],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-bold tabular-nums">{value}%</span>
                  <Progress value={value as number} className="h-1.5" aria-label={`${label}: ${value}%`} />
                </dd>
              </div>
            ))}
            <div>
              <dt className="text-xs text-muted-foreground">Perguntas à IA (48 h)</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{metrics.usage.aiQuestions48h}</dd>
            </div>
          </dl>
        </section>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="font-bold">Integrações</h2>
          <p className="mb-3 text-xs text-muted-foreground">Ative cada uma configurando as variáveis indicadas na hospedagem do site.</p>
          <ul className="grid gap-2 text-sm">
            {integrations.map((item) => (
              <li key={item.name} className="flex items-start gap-2">
                {item.on ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-income" />
                ) : (
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span>
                  <span className="font-medium">{item.name}</span>
                  {!item.on ? <span className="block text-xs text-muted-foreground">Desativado · {item.how}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="mb-3 font-bold">Últimos pagamentos do Pro</h2>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento online ainda.</p>
          ) : (
            <ul className="divide-y text-sm">
              {recentPayments.map(({ payment, email }) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{email}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(payment.createdAt.slice(0, 10))} · {payment.months === 12 ? "anual" : `${payment.months} mês`} ·{" "}
                      {payment.provider}
                      {payment.status === "estornado" ? " · estornado" : ""}
                    </span>
                  </span>
                  <span className="font-semibold text-income tabular">{formatMoney(payment.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {unmatched.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-warning/40 bg-card p-5 shadow-xs">
          <h2 className="font-bold">Pagamentos sem conta ({unmatched.length})</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            A pessoa pagou com um e-mail que não tem conta no Recebi. Confirme com ela e informe o e-mail da conta para liberar o Pro.
          </p>
          <ul className="grid gap-3">
            {unmatched.map((payment) => (
              <li key={payment.id} className="grid gap-3 rounded-xl border p-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{payment.email || "sem e-mail"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {payment.provider} · pedido {payment.externalId} · {formatMoney(payment.amountCents)} ·{" "}
                    {payment.months === 12 ? "anual" : "mensal"} · {formatDate(payment.createdAt.slice(0, 10))}
                  </span>
                </span>
                <ActionForm action={adminAssignPayment} submitLabel="Liberar Pro" className="flex flex-wrap items-start gap-2">
                  <input type="hidden" name="id" value={payment.id} />
                  <Input
                    name="email"
                    type="email"
                    required
                    placeholder="E-mail da conta"
                    className="h-9 w-56"
                    aria-label="E-mail da conta"
                  />
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!emailEnabled() ? (
        <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          O envio de e-mails não está configurado. Para redefinir a senha de alguém, use o botão da chave e envie o link pelo WhatsApp.
        </p>
      ) : null}

      <form method="get" action={`${APP_PATH}/admin`} className="mt-6 mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" className="bg-card pl-9" aria-label="Buscar usuários" />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-xs">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-semibold">Usuário</th>
              <th className="px-3 py-2 font-semibold">Cadastro</th>
              <th className="px-3 py-2 font-semibold">Plano</th>
              <th className="px-4 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const pro = hasPro(u);
              return (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      {u.name} {u.isAdmin ? <Badge variant="outline">admin</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-3 py-3 tabular">{formatDate(u.createdAt.slice(0, 10))}</td>
                  <td className="px-3 py-3">
                    {pro ? (
                      <Badge className="bg-[#c9ff3c] text-[#101c34]">
                        Pro{u.planExpiresAt ? ` até ${formatDate(u.planExpiresAt)}` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{u.plan === "pro" ? `Pro vencido em ${formatDate(u.planExpiresAt)}` : "Grátis"}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ActionButton action={setUserPlan} fields={{ userId: u.id, months: "1" }} variant="outline" size="sm">
                        +1 mês
                      </ActionButton>
                      <ActionButton action={setUserPlan} fields={{ userId: u.id, months: "12" }} variant="outline" size="sm">
                        +1 ano
                      </ActionButton>
                      {u.plan === "pro" ? (
                        <ActionButton action={setUserPlan} fields={{ userId: u.id, months: "0" }} variant="ghost" size="sm">
                          Remover Pro
                        </ActionButton>
                      ) : null}
                      <AdminResetLink userId={u.id} email={u.email} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p> : null}
      </div>
    </>
  );
}
