import {
  ArrowRight,
  ChartColumn,
  Check,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  PiggyBank,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/recebi/logo";
import { getCurrentUser } from "@/lib/recebi/auth";
import { APP_PATH, BASE_PATH, FREE_LIMITS, PRO_PRICE_CENTS } from "@/lib/recebi/config";
import { formatMoney } from "@/lib/recebi/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Recebi — controle financeiro para freelancers e MEIs" },
  description: "Organize receitas e despesas, envie cobranças com Pix e saiba quanto sobra de verdade no fim do mês. Grátis para começar.",
  openGraph: {
    title: "Recebi — controle financeiro para freelancers",
    description: "Receitas, despesas, cobranças com Pix e relatórios num só lugar. Grátis para começar.",
    type: "website",
    locale: "pt_BR",
  },
};

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Seu mês em um olhar",
    text: "Quanto entrou, quanto saiu, o lucro e o que ainda falta receber. Sem planilha, sem fórmula.",
  },
  {
    icon: QrCode,
    title: "Cobranças com Pix",
    text: "Monte a cobrança, mande o link pelo WhatsApp e o cliente paga pelo QR Code. Quando pagar, a receita entra sozinha.",
  },
  {
    icon: PiggyBank,
    title: "Sobra livre de verdade",
    text: "O Recebi separa o imposto estimado do seu lucro e mostra quanto você pode retirar com segurança.",
  },
  {
    icon: FolderKanban,
    title: "Clientes e projetos",
    text: "Veja quem mais te paga, quanto cada projeto rendeu e o que ainda está em aberto com cada cliente.",
  },
  {
    icon: ChartColumn,
    title: "Relatórios e limite do MEI",
    text: "Acompanhe o faturamento do ano e receba um alerta quando estiver chegando perto do limite.",
  },
  {
    icon: FileSpreadsheet,
    title: "Pronto para o contador",
    text: "Exporte tudo para Excel com um clique na hora de declarar o imposto de renda ou fechar o mês.",
  },
];

const FAQ = [
  {
    q: "Preciso ter CNPJ ou ser MEI?",
    a: "Não. O Recebi funciona para quem trabalha como pessoa física, MEI ou empresa. Se for MEI, você acompanha o limite anual de faturamento.",
  },
  {
    q: "O dinheiro do Pix passa pelo Recebi?",
    a: "Não. O QR Code é gerado com a sua chave Pix, então o pagamento cai direto na sua conta. Nós não cobramos taxa sobre o que você recebe.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Sim. Suas senhas são guardadas com criptografia, a conexão é protegida e só você acessa suas informações. Você pode exportar ou apagar tudo quando quiser.",
  },
  {
    q: "Posso cancelar o Pro quando quiser?",
    a: "Pode. O Pro é mensal e sem fidelidade. Se não renovar, sua conta volta para o plano Grátis e nada é apagado.",
  },
  {
    q: "Funciona no celular?",
    a: "Funciona. O Recebi abre no navegador do celular, do tablet ou do computador, sem precisar instalar nada.",
  },
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ "conta-excluida"?: string }> }) {
  const user = await getCurrentUser();
  const accountDeleted = (await searchParams)["conta-excluida"] === "1";
  const cta = user ? { href: APP_PATH, label: "Ir para o painel" } : { href: `${BASE_PATH}/cadastro`, label: "Criar conta grátis" };

  return (
    <div className="bg-background">
      {accountDeleted ? (
        <p className="bg-[#c9ff3c] px-4 py-2 text-center text-sm font-semibold text-[#101c34]">
          Sua conta e todos os seus dados foram excluídos. Obrigado por ter usado o Recebi.
        </p>
      ) : null}

      {/* Topo */}
      <div className="bg-[#101c34] text-white">
        <header className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={BASE_PATH} aria-label="Recebi — início">
            <Logo />
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1 text-sm font-semibold sm:gap-6">
            <a href="#recursos" className="hidden text-white/75 hover:text-white md:inline">
              Recursos
            </a>
            <a href="#precos" className="hidden text-white/75 hover:text-white md:inline">
              Preços
            </a>
            <a href="#duvidas" className="hidden text-white/75 hover:text-white md:inline">
              Dúvidas
            </a>
            {user ? null : (
              <Link href={`${BASE_PATH}/entrar`} className="rounded-lg px-3 py-2 text-white/85 hover:text-white">
                Entrar
              </Link>
            )}
            <Link href={cta.href} className="rounded-lg bg-[#c9ff3c] px-3 py-2 text-[#101c34] hover:bg-[#d6ff6a] sm:px-4">
              {user ? "Painel" : "Começar grátis"}
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:54px_54px]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold tracking-wide text-[#c9ff3c]">
                <span className="size-2 rounded-full bg-[#c9ff3c]" /> Para freelancers e MEIs
              </p>
              <h1 className="mt-6 text-[2.6rem] leading-[1.02] font-extrabold tracking-tight sm:text-6xl">
                Freela bom sabe <span className="text-[#c9ff3c]">quanto ganha.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
                Receitas, despesas, cobranças com Pix e relatórios num só lugar. Descubra em segundos quanto entrou, quanto saiu e quanto
                você pode retirar no fim do mês.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={cta.href}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c9ff3c] px-6 py-3.5 font-bold text-[#101c34] shadow-[6px_6px_0_#ff6948] transition-transform hover:-translate-y-0.5"
                >
                  {cta.label} <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#como-funciona"
                  className="px-2 py-3 text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
                >
                  Ver como funciona
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
                {["Grátis para começar", "Sem cartão de crédito", "Sem taxa sobre seus recebimentos"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="size-4 text-[#c9ff3c]" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <HeroMockup />
          </div>
        </section>
      </div>

      {/* Dores */}
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
          {[
            ["“Recebi bem esse mês, mas cadê o dinheiro?”", "Veja o lucro real, já descontando despesas e impostos."],
            ["“Esqueci de cobrar aquele cliente.”", "Cobranças em aberto e atrasadas aparecem logo no painel."],
            ["“Minha planilha virou uma bagunça.”", "Tudo organizado por mês, cliente, projeto e categoria."],
          ].map(([quote, answer]) => (
            <div key={quote}>
              <p className="font-bold">{quote}</p>
              <p className="mt-1 text-sm text-muted-foreground">{answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 lg:py-28">
        <p className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">Recursos</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
          Tudo o que um freela precisa para cuidar do dinheiro.
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border bg-card p-6 shadow-xs">
              <span className="grid size-11 place-items-center rounded-xl bg-[#101c34] text-[#c9ff3c]">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="scroll-mt-8 bg-[#101c34] text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <p className="text-xs font-bold tracking-[0.16em] text-[#c9ff3c] uppercase">Como funciona</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">Comece em 5 minutos.</h2>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
            {[
              ["Crie sua conta", "Cadastre sua chave Pix, sua meta mensal e seus principais clientes."],
              ["Lance e cobre", "Registre receitas e despesas em segundos e envie cobranças com link e QR Code."],
              ["Acompanhe", "Veja lucro, pendências, imposto estimado e relatórios atualizados automaticamente."],
            ].map(([title, text], i) => (
              <li key={title} className="bg-[#101c34] p-7">
                <span className="grid size-10 place-items-center rounded-full bg-[#c9ff3c] text-sm font-extrabold text-[#101c34]">
                  {i + 1}
                </span>
                <h3 className="mt-8 text-xl font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 lg:py-28">
        <div className="text-center">
          <p className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">Preços</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">Simples como deve ser.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Comece grátis. Mude para o Pro quando seu negócio crescer.</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
          <PriceCard
            name="Grátis"
            price="R$ 0"
            period="para sempre"
            items={[
              "Receitas e despesas ilimitadas",
              `Até ${FREE_LIMITS.clients} clientes ativos`,
              `${FREE_LIMITS.invoicesPerMonth} cobranças com Pix por mês`,
              "Painel com metas e imposto estimado",
              "Exportação para Excel",
            ]}
            href={cta.href}
            cta={user ? "Ir para o painel" : "Criar conta grátis"}
          />
          <PriceCard
            highlight
            name="Pro"
            price={formatMoney(PRO_PRICE_CENTS)}
            period="por mês"
            items={[
              "Tudo do plano Grátis",
              "Clientes e cobranças ilimitados",
              "Relatórios por categoria e cliente",
              "Cobranças sem a marca Recebi",
              "Suporte prioritário no WhatsApp",
            ]}
            href={user ? `${APP_PATH}/plano` : `${BASE_PATH}/cadastro`}
            cta={user ? "Assinar o Pro" : "Começar e assinar depois"}
          />
        </div>
      </section>

      {/* Dúvidas */}
      <section id="duvidas" className="scroll-mt-8 border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">Dúvidas</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Perguntas frequentes</h2>
            <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-income" /> Seus dados são seus: exporte ou apague tudo quando quiser.
            </p>
          </div>
          <div className="divide-y rounded-2xl border bg-background">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border text-sm transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-[#c9ff3c] text-[#101c34]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
          <h2 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Pare de adivinhar. Comece a saber quanto você ganha.
          </h2>
          <Link
            href={cta.href}
            className="inline-flex items-center gap-2 rounded-xl bg-[#101c34] px-6 py-3.5 font-bold text-white hover:bg-[#1b2b4d]"
          >
            {cta.label} <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="bg-[#0a1427] text-white/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="text-white">
            <Logo />
          </div>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href={`${BASE_PATH}/termos`} className="hover:text-white">
              Termos e privacidade
            </Link>
            <Link href="/" className="hover:text-white">
              Criado por Gustavo Henrique
            </Link>
          </nav>
          <p>© {new Date().getFullYear()} Recebi</p>
        </div>
      </footer>
    </div>
  );
}

function PriceCard({
  name,
  price,
  period,
  items,
  href,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  period: string;
  items: string[];
  href: string;
  cta: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={
        highlight
          ? "relative flex flex-col rounded-3xl bg-[#101c34] p-8 text-white shadow-[10px_10px_0_#c9ff3c]"
          : "flex flex-col rounded-3xl border bg-card p-8 shadow-xs"
      }
    >
      {highlight ? (
        <span className="absolute top-6 right-6 rounded-full bg-[#c9ff3c] px-3 py-1 text-xs font-bold text-[#101c34]">Mais completo</span>
      ) : null}
      <h3 className="text-lg font-bold">{name}</h3>
      <p className="mt-4 text-4xl font-extrabold tracking-tight">
        {price}{" "}
        <span className={highlight ? "text-base font-medium text-white/60" : "text-base font-medium text-muted-foreground"}>{period}</span>
      </p>
      <ul className="mt-6 grid gap-3 text-sm">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Check className={highlight ? "mt-0.5 size-4 shrink-0 text-[#c9ff3c]" : "mt-0.5 size-4 shrink-0 text-income"} /> {item}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={
          highlight
            ? "mt-8 rounded-xl bg-[#c9ff3c] px-5 py-3 text-center font-bold text-[#101c34] hover:bg-[#d6ff6a]"
            : "mt-8 rounded-xl border px-5 py-3 text-center font-bold hover:bg-muted"
        }
      >
        {cta}
      </Link>
    </article>
  );
}

/** Uma prévia do painel, desenhada só com HTML/CSS. */
function HeroMockup() {
  const bars = [
    [42, 18],
    [55, 22],
    [48, 30],
    [70, 24],
    [62, 20],
    [88, 26],
  ];
  return (
    <div aria-hidden className="relative mx-auto mb-6 w-full max-w-md lg:max-w-none">
      <div className="rotate-[1.5deg] rounded-2xl border-2 border-[#101c34] bg-[#f6f5f0] p-5 text-[#101c34] shadow-[14px_14px_0_#ff6948]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">Setembro</p>
          <span className="rounded-full bg-[#15803d]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[#15803d]">+18% vs agosto</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white p-3">
            <p className="text-[0.65rem] text-[#5c6679]">Recebido</p>
            <p className="text-lg font-extrabold">R$ 8.420</p>
          </div>
          <div className="rounded-xl bg-[#101c34] p-3 text-white">
            <p className="text-[0.65rem] text-white/60">Sobra livre</p>
            <p className="text-lg font-extrabold text-[#c9ff3c]">R$ 6.105</p>
          </div>
        </div>
        <div className="mt-4 flex h-28 items-end gap-3 rounded-xl bg-white px-4 pt-4 pb-3">
          {bars.map(([income, expense], i) => (
            <div key={i} className="flex h-full flex-1 items-end justify-center gap-1">
              <span className="w-full rounded-t bg-[#1f9d55]" style={{ height: `${income}%` }} />
              <span className="w-full rounded-t bg-[#ff6948]" style={{ height: `${expense}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          {[
            ["Cobrança #0014 · Studio Lima", "R$ 1.800", "Aguardando"],
            ["Landing page · Café Aroma", "R$ 2.400", "Pago"],
          ].map(([title, value, status]) => (
            <div key={title} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-xs">
              <span className="font-semibold">{title}</span>
              <span className="flex items-center gap-2">
                <span className={status === "Pago" ? "text-[#15803d]" : "text-[#b45309]"}>{status}</span>
                <span className="font-bold">{value}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-14 -left-6 hidden -rotate-3 rounded-2xl border-2 border-[#101c34] bg-white p-3 text-[#101c34] shadow-[8px_8px_0_#c9ff3c] sm:block">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-lg bg-[#101c34] text-[#c9ff3c]">
            <QrCode className="size-7" />
          </span>
          <span>
            <span className="block text-[0.65rem] text-[#5c6679]">Pix recebido</span>
            <span className="block text-sm font-extrabold">+ R$ 1.800,00</span>
          </span>
        </div>
      </div>
    </div>
  );
}
