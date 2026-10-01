import { CalendarHeart, Gift, MessageCircle, Send, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/recebi/copy-button";
import { PageHeader } from "@/components/recebi/page-header";
import { StatCard } from "@/components/recebi/stat-card";
import { requireUser } from "@/lib/recebi/auth";
import { BASE_PATH } from "@/lib/recebi/config";
import { formatDate } from "@/lib/recebi/dates";
import { siteOrigin } from "@/lib/recebi/origin";
import { ensureReferralCode, MAX_REWARDS_PER_YEAR, REFERRED_TRIAL_DAYS, referralStats } from "@/lib/recebi/referral";

export const metadata: Metadata = { title: "Indique e ganhe" };

const STEPS = [
  { icon: Send, title: "Envie seu link", text: "Para outros freelancers: no WhatsApp, Instagram ou e-mail." },
  { icon: UserPlus, title: `Seu amigo ganha ${REFERRED_TRIAL_DAYS} dias de Pro`, text: "Assim que criar a conta pelo seu link." },
  { icon: Gift, title: "Você ganha 1 mês de Pro", text: "Quando ele assinar o Pro. Sem limite de amigos (até 12 meses por ano)." },
];

export default async function ReferralPage() {
  const user = await requireUser();
  if (user.isDemo) {
    return (
      <>
        <PageHeader title="Indique e ganhe" description="Ganhe meses de Pro indicando o Recebi para outros freelancers." />
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Crie sua conta grátis para ter o seu link de convite.
        </p>
      </>
    );
  }
  const [code, stats] = await Promise.all([ensureReferralCode(user), referralStats(user.id)]);
  const link = `${await siteOrigin()}${BASE_PATH}/convite/${code}`;
  const message = `Uso o Recebi para controlar meu dinheiro de freelancer: orçamento com aprovação online, cobrança com Pix e o lucro do mês. Criando a conta pelo meu link você ganha ${REFERRED_TRIAL_DAYS} dias de Pro grátis: ${link}`;
  const subscribed = stats.invited.filter((i) => i.subscribed).length;

  return (
    <>
      <PageHeader title="Indique e ganhe" description="Cada amigo que assinar o Pro vale 1 mês de Pro grátis para você." />

      <section className="relative overflow-hidden rounded-3xl bg-[#101c34] p-6 text-white shadow-lg sm:p-8">
        <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-[#c9ff3c]/15 blur-3xl" />
        <p className="relative flex items-center gap-2 text-sm text-white/70">
          <Gift className="size-4 text-[#c9ff3c]" /> Seu link de convite
        </p>
        <p className="relative mt-2 font-mono text-lg break-all text-[#c9ff3c] sm:text-2xl">{link}</p>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <CopyButton value={link} label="Copiar link" className="bg-[#c9ff3c] text-[#101c34] hover:bg-[#c9ff3c]/90" />
          <Button asChild variant="secondary">
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              <MessageCircle /> Enviar no WhatsApp
            </a>
          </Button>
          <CopyButton
            value={message}
            label="Copiar mensagem pronta"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
          />
        </div>
        <p className="relative mt-4 text-xs text-white/60">
          Seu código: <span className="font-mono font-bold text-white">{code}</span>
        </p>
      </section>

      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="rounded-2xl border bg-card p-5 shadow-xs">
            <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <span className="grid size-6 place-items-center rounded-full bg-[#c9ff3c] text-[#101c34]">{i + 1}</span>
              Passo {i + 1}
            </span>
            <Icon className="mt-4 size-6" />
            <p className="mt-2 font-bold">{title}</p>
            <p className="text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Amigos convidados" value={String(stats.invited.length)} icon={<Users />} />
        <StatCard label="Assinaram o Pro" value={String(subscribed)} icon={<UserPlus />} tone="income" />
        <StatCard
          label="Meses de Pro ganhos"
          value={String(stats.monthsEarned)}
          icon={<CalendarHeart />}
          tone="brand"
          hint={`Limite de ${MAX_REWARDS_PER_YEAR} meses por ano`}
        />
      </div>

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-xs">
        <h2 className="font-bold">Seus convidados</h2>
        {stats.invited.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Ninguém ainda. Que tal mandar o link para aquele amigo freela agora?</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {stats.invited.map((person, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <span>
                  <span className="font-semibold">{person.firstName}</span>
                  <span className="block text-xs text-muted-foreground">Criou conta em {formatDate(person.createdAt.slice(0, 10))}</span>
                </span>
                {person.subscribed ? (
                  <span className="rounded-full bg-income/15 px-2.5 py-0.5 text-xs font-semibold text-income">Assinou o Pro 🎉</span>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Ainda no Grátis</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
