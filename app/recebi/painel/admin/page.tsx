import { Search } from "lucide-react";
import type { Metadata } from "next";
import { desc, like, or, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/recebi/action-button";
import { AdminResetLink } from "@/components/recebi/admin-reset-link";
import { PageHeader } from "@/components/recebi/page-header";
import { StatCard } from "@/components/recebi/stat-card";
import { getDb } from "@/db";
import { invoices, transactions, users } from "@/db/schema";
import { setUserPlan } from "@/lib/recebi/actions/admin";
import { hasPro, requireAdmin } from "@/lib/recebi/auth";
import { APP_PATH, PRO_PRICE_CENTS } from "@/lib/recebi/config";
import { addDays, formatDate, todayISO } from "@/lib/recebi/dates";
import { emailEnabled } from "@/lib/recebi/email";
import { formatMoney } from "@/lib/recebi/money";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = (await searchParams).q?.trim().slice(0, 100) ?? "";
  const db = getDb();
  const since = addDays(todayISO(), -30);
  const term = `%${q.replace(/[%_]/g, "")}%`;

  const [list, [counts], [invoiceCount], [transactionCount]] = await Promise.all([
    db
      .select()
      .from(users)
      .where(q ? or(like(users.email, term), like(users.name, term)) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(100),
    db
      .select({
        total: sql<number>`count(*)`,
        pro: sql<number>`coalesce(sum(case when ${users.plan} = 'pro' and (${users.planExpiresAt} is null or ${users.planExpiresAt} >= ${todayISO()}) then 1 else 0 end), 0)`,
        recent: sql<number>`coalesce(sum(case when ${users.createdAt} >= ${since} then 1 else 0 end), 0)`,
      })
      .from(users),
    db.select({ count: sql<number>`count(*)` }).from(invoices),
    db.select({ count: sql<number>`count(*)` }).from(transactions),
  ]);

  return (
    <>
      <PageHeader title="Administração" description="Usuários, planos e suporte do Recebi." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Usuários" value={String(counts.total)} hint={`${counts.recent} nos últimos 30 dias`} />
        <StatCard
          label="Assinantes Pro"
          value={String(counts.pro)}
          tone="brand"
          hint={`Receita mensal estimada: ${formatMoney(counts.pro * PRO_PRICE_CENTS)}`}
        />
        <StatCard label="Cobranças criadas" value={String(invoiceCount.count)} />
        <StatCard label="Lançamentos" value={String(transactionCount.count)} />
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
