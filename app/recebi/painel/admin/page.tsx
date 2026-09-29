import { CircleCheck, CircleDashed, Search } from "lucide-react";
import type { Metadata } from "next";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/recebi/action-button";
import { AdminResetLink } from "@/components/recebi/admin-reset-link";
import { PageHeader } from "@/components/recebi/page-header";
import { StatCard } from "@/components/recebi/stat-card";
import { getDb } from "@/db";
import { invoices, payments, transactions, users } from "@/db/schema";
import { setUserPlan } from "@/lib/recebi/actions/admin";
import { hasPro, requireAdmin } from "@/lib/recebi/auth";
import { APP_PATH, PRO_PRICE_CENTS } from "@/lib/recebi/config";
import { addDays, formatDate, todayISO } from "@/lib/recebi/dates";
import { billingEnabled } from "@/lib/recebi/billing";
import { emailEnabled, readEnv } from "@/lib/recebi/email";
import { filesEnabled } from "@/lib/recebi/files";
import { googleEnabled } from "@/lib/recebi/google";
import { formatMoney } from "@/lib/recebi/money";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = (await searchParams).q?.trim().slice(0, 100) ?? "";
  const db = getDb();
  const since = addDays(todayISO(), -30);
  const term = `%${q.replace(/[%_]/g, "")}%`;

  const [list, [counts], [invoiceCount], [transactionCount], recentPayments, [revenue]] = await Promise.all([
    db
      .select()
      .from(users)
      .where(q ? and(eq(users.isDemo, false), or(like(users.email, term), like(users.name, term))) : eq(users.isDemo, false))
      .orderBy(desc(users.createdAt))
      .limit(100),
    db
      .select({
        total: sql<number>`count(*)`,
        pro: sql<number>`coalesce(sum(case when ${users.plan} = 'pro' and (${users.planExpiresAt} is null or ${users.planExpiresAt} >= ${todayISO()}) then 1 else 0 end), 0)`,
        recent: sql<number>`coalesce(sum(case when ${users.createdAt} >= ${since} then 1 else 0 end), 0)`,
        demos: sql<number>`coalesce(sum(case when ${users.isDemo} then 1 else 0 end), 0)`,
      })
      .from(users),
    db.select({ count: sql<number>`count(*)` }).from(invoices),
    db.select({ count: sql<number>`count(*)` }).from(transactions),
    db
      .select({ payment: payments, email: users.email })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.userId))
      .orderBy(desc(payments.createdAt))
      .limit(10),
    db
      .select({
        month: sql<number>`coalesce(sum(case when ${payments.createdAt} >= ${since} then ${payments.amountCents} else 0 end), 0)`,
        total: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
      })
      .from(payments),
  ]);

  const integrations = [
    { name: "Envio de e-mails (Resend)", on: emailEnabled(), how: "RESEND_API_KEY e RECEBI_EMAIL_FROM" },
    {
      name: "Venda automática do Pro (Mercado Pago)",
      on: billingEnabled(),
      how: "MERCADOPAGO_ACCESS_TOKEN (e MERCADOPAGO_WEBHOOK_SECRET)",
    },
    { name: "Login com Google", on: googleEnabled(), how: "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET" },
    { name: "Comprovantes e logos (R2)", on: filesEnabled(), how: "binding FILES em .openai/hosting.json" },
    {
      name: "Lembretes diários de cobrança",
      on: !!readEnv("RECEBI_CRON_SECRET") && emailEnabled(),
      how: "RECEBI_CRON_SECRET + agendador chamando /recebi/api/lembretes",
    },
  ];

  return (
    <>
      <PageHeader title="Administração" description="Usuários, planos e suporte do Recebi." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Usuários"
          value={String(counts.total - counts.demos)}
          hint={`${counts.recent - counts.demos} nos últimos 30 dias · ${counts.demos} demonstrações ativas`}
        />
        <StatCard
          label="Assinantes Pro"
          value={String(counts.pro)}
          tone="brand"
          hint={`Receita mensal estimada: ${formatMoney(counts.pro * PRO_PRICE_CENTS)}`}
        />
        <StatCard
          label="Vendas online (30 dias)"
          value={formatMoney(revenue.month)}
          tone="income"
          hint={`Total pelo Mercado Pago: ${formatMoney(revenue.total)}`}
        />
        <StatCard
          label="Cobranças e lançamentos"
          value={`${invoiceCount.count} · ${transactionCount.count}`}
          hint="Criados por todos os usuários"
        />
      </div>

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
                      {formatDate(payment.createdAt.slice(0, 10))} · {payment.months === 12 ? "anual" : `${payment.months} mês`}
                    </span>
                  </span>
                  <span className="font-semibold text-income tabular">{formatMoney(payment.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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
