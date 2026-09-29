import {
  ArrowRight,
  BellRing,
  Calculator,
  ChartColumn,
  Check,
  FileCheck2,
  FileSignature,
  FileSpreadsheet,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Lock,
  Paperclip,
  PiggyBank,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/recebi/logo";
import { Reveal } from "@/components/recebi/reveal";
import { startDemo } from "@/lib/recebi/actions/demo";
import { getCurrentUser } from "@/lib/recebi/auth";
import { APP_PATH, BASE_PATH, FREE_LIMITS, PRO_PRICE_CENTS, PRO_YEARLY_PRICE_CENTS } from "@/lib/recebi/config";
import { formatMoney } from "@/lib/recebi/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Recebi — controle financeiro para freelancers e MEIs" },
  description:
    "Orçamentos que o cliente aprova com um clique, cobranças com Pix, recibos e o seu lucro real do mês. O controle financeiro feito para freelancers. Grátis para começar.",
  openGraph: {
    title: "Recebi — controle financeiro para freelancers",
    description: "Orçamentos, cobranças com Pix, recibos e relatórios num só lugar. Grátis para começar.",
    type: "website",
    locale: "pt_BR",
  },
};

const PROFESSIONS = ["Designers", "Desenvolvedores", "Social media", "Fotógrafos", "Redatores", "Consultores", "Videomakers", "Arquitetos"];

const FEATURES = [
  {
    icon: FileSignature,
    title: "Orçamentos com aprovação",
    text: "O cliente abre o link, aprova com um clique e a cobrança é criada sozinha.",
  },
  { icon: QrCode, title: "Cobranças com Pix", text: "QR Code e Pix copia e cola em cada cobrança. O dinheiro cai direto na sua conta." },
  { icon: FileCheck2, title: "Recibos automáticos", text: "Recibo com valor por extenso, pronto para imprimir ou enviar em PDF." },
  { icon: LayoutDashboard, title: "Painel do mês", text: "Entradas, saídas, lucro, pendências e comparação com o mês anterior." },
  { icon: PiggyBank, title: "Sobra livre de verdade", text: "Separa o imposto estimado e mostra quanto você pode retirar com segurança." },
  {
    icon: BellRing,
    title: "Lembretes automáticos",
    text: "O cliente recebe um e-mail antes e depois do vencimento. Você não precisa cobrar.",
  },
  {
    icon: ChartColumn,
    title: "Relatórios e limite do MEI",
    text: "Faturamento do ano, categorias, melhores clientes e alerta perto do limite.",
  },
  { icon: Calculator, title: "Calculadora de preço", text: "Descubra o valor da sua hora considerando impostos, custos e férias." },
  { icon: FolderKanban, title: "Clientes e projetos", text: "Quanto cada cliente já pagou e quanto cada projeto realmente rendeu." },
  { icon: Paperclip, title: "Comprovantes guardados", text: "Anexe a nota ou o recibo em cada despesa e encontre na hora do imposto." },
  { icon: Smartphone, title: "App no celular", text: "Instale na tela inicial e use como aplicativo, no Android ou no iPhone." },
  { icon: FileSpreadsheet, title: "Pronto para o contador", text: "Exporte tudo para Excel com um clique no fechamento do mês ou do ano." },
];

const FAQ = [
  {
    q: "Preciso ter CNPJ ou ser MEI?",
    a: "Não. O Recebi funciona para quem trabalha como pessoa física, MEI ou empresa. Se for MEI, você acompanha o limite anual de faturamento.",
  },
  {
    q: "Como o cliente aprova um orçamento?",
    a: "Você envia o link pelo WhatsApp ou e-mail. O cliente vê a proposta no celular, toca em “Aprovar” e recebe na hora a cobrança com Pix. Ele não precisa criar conta.",
  },
  {
    q: "O dinheiro do Pix passa pelo Recebi?",
    a: "Não. O QR Code é gerado com a sua chave Pix, então o pagamento cai direto na sua conta. O Recebi não cobra taxa sobre o que você recebe.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Sim. Senhas são guardadas com criptografia, a conexão é protegida e só você acessa suas informações. Você pode exportar ou apagar tudo quando quiser.",
  },
  {
    q: "Posso cancelar o Pro quando quiser?",
    a: "Pode. Não há fidelidade. Se não renovar, sua conta volta para o plano Grátis e nada é apagado.",
  },
  {
    q: "Funciona no celular?",
    a: "Funciona e dá para instalar como aplicativo na tela inicial, sem passar pela loja de apps.",
  },
];

function DemoButton({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <form action={startDemo}>
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ "conta-excluida"?: string; demo?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const cta = user ? { href: APP_PATH, label: "Ir para o painel" } : { href: `${BASE_PATH}/cadastro`, label: "Criar conta grátis" };

  return (
    <div className="overflow-x-clip bg-background">
      {params["conta-excluida"] === "1" ? (
        <p className="bg-[#c9ff3c] px-4 py-2 text-center text-sm font-semibold text-[#101c34]">
          Sua conta e todos os seus dados foram excluídos. Obrigado por ter usado o Recebi.
        </p>
      ) : null}
      {params.demo === "limite" ? (
        <p className="bg-[#c9ff3c] px-4 py-2 text-center text-sm font-semibold text-[#101c34]">
          Muitas demonstrações abertas agora. Tente de novo em alguns minutos ou crie sua conta grátis.
        </p>
      ) : null}

      {/* Topo + hero */}
      <div className="relative overflow-hidden bg-[#101c34] text-white">
        <div
          aria-hidden
          className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:54px_54px]"
        />
        <div aria-hidden className="absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-[#c9ff3c]/10 blur-3xl" />

        <header className="relative mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={BASE_PATH} aria-label="Recebi — início">
            <Logo />
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1 text-sm font-semibold sm:gap-6">
            <a href="#recursos" className="hidden text-white/75 hover:text-white md:inline">
              Recursos
            </a>
            <a href="#como-funciona" className="hidden text-white/75 hover:text-white md:inline">
              Como funciona
            </a>
            <a href="#precos" className="hidden text-white/75 hover:text-white md:inline">
              Preços
            </a>
            <Link href={`${BASE_PATH}/calculadora`} className="hidden text-white/75 hover:text-white lg:inline">
              Calculadora
            </Link>
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

        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-24 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-32">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold tracking-wide text-[#c9ff3c]">
              <Sparkles className="size-3.5" /> Novo: orçamentos que o cliente aprova com um clique
            </p>
            <h1 className="mt-6 text-[2.6rem] leading-[1.02] font-extrabold tracking-tight sm:text-6xl lg:text-[4.1rem]">
              Freela bom sabe <span className="text-[#c9ff3c]">quanto ganha.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              Do orçamento ao recibo: envie propostas, cobre com Pix e veja quanto sobra de verdade no fim do mês. Tudo num só lugar, feito
              para freelancers e MEIs.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={cta.href}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c9ff3c] px-6 py-3.5 font-bold text-[#101c34] shadow-[6px_6px_0_#ff6948] transition-transform hover:-translate-y-0.5"
              >
                {cta.label} <ArrowRight className="size-4" />
              </Link>
              {user ? null : (
                <DemoButton className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 px-6 py-3.5 font-semibold text-white transition hover:border-white/60 hover:bg-white/5 sm:w-auto">
                  Ver demonstração
                </DemoButton>
              )}
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
              {["Grátis para começar", "Sem cartão de crédito", "Sem taxa sobre seus recebimentos"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-[#c9ff3c]" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <HeroMockup />
          </div>
        </section>
      </div>

      {/* Para quem */}
      <section className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 text-sm font-semibold text-muted-foreground sm:px-6">
          <span className="text-xs font-bold tracking-[0.16em] uppercase">Feito para</span>
          {PROFESSIONS.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      </section>

      {/* Fluxo do orçamento ao recibo */}
      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 lg:py-28">
        <Reveal>
          <p className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">Do orçamento ao recibo</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">
            O caminho do dinheiro, sem planilha e sem cobrar cliente no susto.
          </h2>
        </Reveal>
        <ol className="mt-12 grid gap-4 md:grid-cols-4">
          {[
            { icon: FileSignature, title: "Envie o orçamento", text: "Monte a proposta e mande o link pelo WhatsApp." },
            { icon: Check, title: "Cliente aprova", text: "Um clique no celular. Você recebe o aviso na hora." },
            { icon: QrCode, title: "Recebe com Pix", text: "A cobrança com QR Code é criada automaticamente." },
            { icon: FileCheck2, title: "Recibo e relatório", text: "Recibo pronto e o lucro do mês atualizado." },
          ].map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Reveal delay={i * 120} className="h-full">
                <div className="relative h-full rounded-2xl border bg-card p-6 shadow-xs">
                  <span className="absolute top-6 right-6 text-5xl font-black text-muted-foreground/15 tabular">{i + 1}</span>
                  <span className="grid size-11 place-items-center rounded-xl bg-[#101c34] text-[#c9ff3c] dark:bg-[#c9ff3c] dark:text-[#101c34]">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* Destaques com visual */}
      <section className="bg-[#101c34] text-white">
        <div className="mx-auto grid max-w-6xl gap-20 px-4 py-20 sm:px-6 lg:py-28">
          <Spotlight
            kicker="Orçamentos"
            title="Seu cliente aprova em um clique. A cobrança sai sozinha."
            text="Nada de “vou ver e te falo”. O orçamento chega com cara de empresa, com validade e condições. Aprovou, a cobrança com Pix é gerada na hora e você recebe o aviso."
            bullets={["Link bonito que abre no celular", "Aprovar ou recusar com comentário", "Taxa de aprovação no seu painel"]}
            visual={<QuoteMockup />}
          />
          <Spotlight
            reverse
            kicker="Cobranças e recibos"
            title="Pix direto na sua conta, recibo pronto em seguida."
            text="Cada cobrança tem QR Code e Pix copia e cola com o valor certo. Quando o dinheiro cai, um clique registra a receita e libera o recibo com valor por extenso."
            bullets={["Sem taxa sobre o que você recebe", "Lembretes automáticos antes do vencimento", "Sua logo nos documentos (Pro)"]}
            visual={<PixMockup />}
          />
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 lg:py-28">
        <Reveal>
          <p className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">Recursos</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
            Tudo o que um freela precisa para cuidar do dinheiro.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={(i % 3) * 80}>
              <article className="group h-full rounded-2xl border bg-card p-6 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="grid size-11 place-items-center rounded-xl bg-muted text-foreground transition group-hover:bg-[#c9ff3c] group-hover:text-[#101c34]">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Calculadora */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-[#c9ff3c] p-8 text-[#101c34] sm:p-12">
            <Calculator aria-hidden className="absolute -right-6 -bottom-8 size-48 opacity-10" />
            <p className="text-xs font-bold tracking-[0.16em] uppercase">Grátis, sem cadastro</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Não sabe quanto cobrar? Descubra o valor da sua hora em 1 minuto.
            </h2>
            <Link
              href={`${BASE_PATH}/calculadora`}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#101c34] px-5 py-3 font-bold text-white hover:bg-[#1b2b4d]"
            >
              Abrir a calculadora <ArrowRight className="size-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Preços */}
      <section id="precos" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 lg:py-28">
        <Reveal className="text-center">
          <p className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">Preços</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">Simples como deve ser.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Comece grátis. Mude para o Pro quando seu negócio crescer.</p>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          <Reveal className="h-full">
            <PriceCard
              name="Grátis"
              price="R$ 0"
              period="para sempre"
              items={[
                "Receitas e despesas ilimitadas",
                `Até ${FREE_LIMITS.clients} clientes ativos`,
                `${FREE_LIMITS.quotesPerMonth} orçamentos e ${FREE_LIMITS.invoicesPerMonth} cobranças por mês`,
                "Pix, recibos e calculadora de preço",
                "Painel com metas e imposto estimado",
                "App no celular e exportação para Excel",
              ]}
              href={cta.href}
              cta={user ? "Ir para o painel" : "Criar conta grátis"}
            />
          </Reveal>
          <Reveal delay={120} className="h-full">
            <PriceCard
              highlight
              name="Pro"
              price={formatMoney(PRO_PRICE_CENTS)}
              period="por mês"
              extra={`ou ${formatMoney(PRO_YEARLY_PRICE_CENTS)} por ano (2 meses grátis)`}
              items={[
                "Tudo do plano Grátis, sem limites",
                "Lembretes automáticos de cobrança",
                "Relatórios por categoria e cliente",
                "Comprovantes anexados às despesas",
                "Sua logo em orçamentos, cobranças e recibos",
                "Sem a marca Recebi e suporte prioritário",
              ]}
              href={user ? `${APP_PATH}/plano` : `${BASE_PATH}/cadastro`}
              cta={user ? "Assinar o Pro" : "Começar e assinar depois"}
            />
          </Reveal>
        </div>
      </section>

      {/* Segurança */}
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {[
            { icon: Lock, title: "Senhas criptografadas", text: "Nunca guardamos sua senha em texto puro." },
            { icon: Wallet, title: "Pix direto para você", text: "O dinheiro não passa pelo Recebi." },
            { icon: KeyRound, title: "Links secretos", text: "Cada orçamento e cobrança tem um link único." },
            { icon: ShieldCheck, title: "Seus dados são seus", text: "Exporte ou apague tudo quando quiser." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-income" />
              <div>
                <p className="font-bold">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dúvidas */}
      <section id="duvidas" className="mx-auto grid max-w-6xl scroll-mt-8 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">Dúvidas</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Perguntas frequentes</h2>
          <p className="mt-4 text-sm text-muted-foreground">Ainda com dúvida? Abra a demonstração e explore à vontade, sem criar conta.</p>
          {user ? null : (
            <DemoButton className="mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
              <Sparkles className="size-4" /> Ver demonstração
            </DemoButton>
          )}
        </div>
        <div className="divide-y rounded-2xl border bg-card">
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
      </section>

      {/* CTA final */}
      <section className="bg-[#101c34] text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <h2 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Pare de adivinhar. <span className="text-[#c9ff3c]">Comece a saber quanto você ganha.</span>
          </h2>
          <Link
            href={cta.href}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#c9ff3c] px-6 py-3.5 font-bold text-[#101c34] shadow-[6px_6px_0_#ff6948] transition-transform hover:-translate-y-0.5"
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
            <Link href={`${BASE_PATH}/calculadora`} className="hover:text-white">
              Calculadora de preço
            </Link>
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

function Spotlight({
  kicker,
  title,
  text,
  bullets,
  visual,
  reverse,
}: {
  kicker: string;
  title: string;
  text: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <Reveal className={reverse ? "lg:order-2" : undefined}>
        <p className="text-xs font-bold tracking-[0.16em] text-[#c9ff3c] uppercase">{kicker}</p>
        <h3 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h3>
        <p className="mt-4 leading-relaxed text-white/70">{text}</p>
        <ul className="mt-6 grid gap-2 text-sm">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <Check className="size-4 text-[#c9ff3c]" /> {b}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={150} className={reverse ? "lg:order-1" : undefined}>
        {visual}
      </Reveal>
    </div>
  );
}

function PriceCard({
  name,
  price,
  period,
  extra,
  items,
  href,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  period: string;
  extra?: string;
  items: string[];
  href: string;
  cta: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={
        highlight
          ? "relative flex h-full flex-col rounded-3xl bg-[#101c34] p-8 text-white shadow-[10px_10px_0_#c9ff3c]"
          : "flex h-full flex-col rounded-3xl border bg-card p-8 shadow-xs"
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
      {extra ? <p className="mt-1 text-sm text-[#c9ff3c]">{extra}</p> : <p className="mt-1 text-sm">&nbsp;</p>}
      <ul className="mt-6 mb-8 grid gap-3 text-sm">
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
            ? "mt-auto rounded-xl bg-[#c9ff3c] px-5 py-3 text-center font-bold text-[#101c34] hover:bg-[#d6ff6a]"
            : "mt-auto rounded-xl border px-5 py-3 text-center font-bold hover:bg-muted"
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
          <span className="rounded-full bg-[#15803d]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[#15803d]">▲ 18% vs agosto</span>
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
            ["Orçamento #0021 · Studio Lima", "R$ 1.800", "Aprovado"],
            ["Cobrança #0014 · Café Aroma", "R$ 2.400", "Pago"],
          ].map(([title, value, status]) => (
            <div key={title} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-xs">
              <span className="font-semibold">{title}</span>
              <span className="flex items-center gap-2">
                <span className="text-[#15803d]">{status}</span>
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

function QuoteMockup() {
  return (
    <div aria-hidden className="relative mx-auto max-w-sm">
      <div className="rounded-[2rem] border-4 border-white/15 bg-[#f6f5f0] p-4 text-[#101c34] shadow-2xl">
        <div className="rounded-2xl bg-white p-4">
          <p className="text-[0.6rem] font-bold tracking-[0.16em] text-[#5c6679] uppercase">Orçamento</p>
          <p className="text-2xl font-black">#0021</p>
          <p className="mt-1 inline-block rounded-full bg-[#b45309]/10 px-2 py-0.5 text-[0.6rem] font-bold text-[#b45309]">
            Aguardando resposta
          </p>
          <div className="mt-4 grid gap-2 text-xs">
            <div className="flex justify-between border-b pb-2">
              <span>Identidade visual</span>
              <span className="font-bold">R$ 1.500</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span>Manual da marca</span>
              <span className="font-bold">R$ 300</span>
            </div>
            <div className="flex justify-between pt-1 text-sm">
              <span className="font-bold">Total</span>
              <span className="font-black">R$ 1.800</span>
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border-2 border-[#101c34] bg-white p-4 shadow-[5px_5px_0_#c9ff3c]">
          <p className="text-sm font-extrabold">Gostou da proposta?</p>
          <div className="mt-3 rounded-xl bg-[#15803d] py-2.5 text-center text-sm font-bold text-white">✓ Aprovar orçamento</div>
          <div className="mt-2 rounded-xl border py-2 text-center text-xs font-semibold">Recusar</div>
        </div>
      </div>
      <div className="absolute -top-4 right-2 rotate-3 rounded-xl sm:-right-4 bg-[#c9ff3c] px-3 py-2 text-xs font-extrabold text-[#101c34] shadow-lg">
        🎉 Studio Lima aprovou!
      </div>
    </div>
  );
}

function PixMockup() {
  // Um desenho de QR Code só para ilustrar (não é um código de pagamento real).
  const pattern =
    "1111111010011111110000010101100100000110111010011101011101101110101100010111011011101000111101110110000010100101000001111111010101111111";
  return (
    <div aria-hidden className="relative mx-auto grid max-w-md gap-4 sm:grid-cols-[1fr_0.9fr]">
      <div className="rounded-2xl bg-white p-5 text-[#101c34] shadow-2xl">
        <p className="text-sm font-extrabold">Pague com Pix</p>
        <div className="mx-auto mt-3 grid aspect-square w-full max-w-[150px] grid-cols-[repeat(11,1fr)] gap-px rounded-lg border p-2">
          {pattern
            .slice(0, 121)
            .split("")
            .map((cell, i) => (
              <span key={i} className={cell === "1" ? "bg-[#101c34]" : "bg-transparent"} />
            ))}
        </div>
        <p className="mt-3 text-center text-xl font-black">R$ 2.400,00</p>
        <div className="mt-3 rounded-lg bg-[#101c34] py-2 text-center text-xs font-bold text-white">Copiar código Pix</div>
      </div>
      <div className="self-end rounded-2xl border-t-8 border-[#c9ff3c] bg-white p-5 text-[#101c34] shadow-2xl sm:-rotate-2">
        <p className="text-[0.6rem] font-bold tracking-[0.18em] text-[#5c6679] uppercase">Recibo</p>
        <p className="text-lg font-black">Nº 0014</p>
        <p className="mt-2 text-[0.7rem] leading-relaxed">
          Recebi de <b>Café Aroma</b> a importância de <b>R$ 2.400,00 (dois mil e quatrocentos reais)</b>.
        </p>
        <div className="mt-4 border-t border-[#101c34]/40 pt-1 text-center text-[0.65rem] font-bold">Marina Costa</div>
      </div>
    </div>
  );
}
