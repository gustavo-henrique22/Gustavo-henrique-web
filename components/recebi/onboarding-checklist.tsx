import { ArrowRight, Check, Rocket, X } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import type { User } from "@/db/schema";
import { dismissOnboarding } from "@/lib/recebi/actions/account";
import { APP_PATH } from "@/lib/recebi/config";
import { cn } from "@/lib/utils";
import { ActionButton } from "./action-button";

type Snapshot = { clients: number; sentDocuments: number; incomes: number };

export function onboardingSteps(
  user: Pick<User, "businessName" | "document" | "pixKey" | "monthlyGoalCents" | "publicProfile" | "emailVerifiedAt">,
  data: Snapshot,
  emailOn: boolean,
) {
  const steps = [
    {
      done: !!user.emailVerifiedAt,
      label: "Confirme seu e-mail",
      text: "Para recuperar a conta e receber avisos importantes.",
      href: `${APP_PATH}/configuracoes/seguranca#email`,
      cta: "Confirmar",
    },
    {
      done: !!(user.businessName || user.document),
      label: "Complete seu perfil",
      text: "Nome do negócio e CPF/CNPJ aparecem nos documentos.",
      href: `${APP_PATH}/configuracoes`,
      cta: "Completar",
    },
    {
      done: !!user.pixKey,
      label: "Cadastre sua chave Pix",
      text: "Toda cobrança ganha QR Code.",
      href: `${APP_PATH}/configuracoes#pix`,
      cta: "Cadastrar",
    },
    {
      done: data.clients > 0,
      label: "Adicione um cliente",
      text: "Para saber quem mais te paga.",
      href: `${APP_PATH}/clientes?novo=1`,
      cta: "Adicionar",
    },
    {
      done: data.sentDocuments > 0,
      label: "Envie um orçamento ou cobrança",
      text: "O cliente aprova e o Pix sai sozinho.",
      href: `${APP_PATH}/orcamentos/novo`,
      cta: "Criar",
    },
    {
      done: data.incomes > 0,
      label: "Lance sua primeira receita",
      text: "Comece a ver seu lucro real.",
      href: `${APP_PATH}/lancamentos?novo=receita`,
      cta: "Lançar",
    },
    {
      done: user.monthlyGoalCents > 0,
      label: "Defina sua meta do mês",
      text: "O painel mostra quanto falta.",
      href: `${APP_PATH}/configuracoes#metas`,
      cta: "Definir",
    },
    {
      done: user.publicProfile,
      label: "Publique sua página",
      text: "Clientes pedem orçamento pelo link na bio.",
      href: `${APP_PATH}/pagina`,
      cta: "Publicar",
    },
  ];
  // Sem envio de e-mails no site, não dá para confirmar: o passo não aparece.
  return emailOn ? steps : steps.slice(1);
}

/** Guia de primeiros passos do painel. Some quando tudo estiver feito ou quando a pessoa esconder. */
export function OnboardingChecklist({ steps, welcome }: { steps: ReturnType<typeof onboardingSteps>; welcome: boolean }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (!next) return null;
  const percent = Math.round((done / steps.length) * 100);

  return (
    <section aria-labelledby="onboarding-title" className="mb-6 overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="relative flex flex-wrap items-center gap-4 bg-[#101c34] py-4 pr-12 pl-5 text-white">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#c9ff3c] text-[#101c34]">
          <Rocket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="onboarding-title" className="font-bold">
            {welcome ? "Conta criada! Vamos deixar tudo pronto? 🚀" : "Primeiros passos"}
          </p>
          <p className="text-sm text-white/70">
            {done} de {steps.length} concluídos · em poucos minutos seu controle financeiro está pronto.
          </p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-56">
          <Progress value={percent} className="h-2 bg-white/15 [&>*]:bg-[#c9ff3c]" aria-label={`${percent}% concluído`} />
          <span className="text-sm font-bold tabular-nums">{percent}%</span>
        </div>
        <ActionButton
          action={dismissOnboarding}
          fields={{}}
          variant="ghost"
          size="icon-sm"
          aria-label="Esconder o guia"
          title="Esconder o guia"
          className="absolute top-2 right-2 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X />
        </ActionButton>
      </div>

      <Link
        href={next.href}
        className="flex flex-wrap items-center gap-3 border-b bg-[#c9ff3c]/15 px-5 py-3 transition hover:bg-[#c9ff3c]/25"
      >
        <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Próximo passo</span>
        <span className="font-semibold">{next.label}</span>
        <span className="hidden text-sm text-muted-foreground sm:inline">— {next.text}</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#101c34] px-3 py-1.5 text-sm font-semibold text-white dark:bg-[#c9ff3c] dark:text-[#101c34]">
          {next.cta} <ArrowRight className="size-4" />
        </span>
      </Link>

      <ol className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <li key={step.label} className="bg-card">
            <Link href={step.href} className="flex h-full gap-3 p-4 hover:bg-muted/50">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  step.done && "border-transparent bg-income text-white",
                  step === next && "border-[#101c34] dark:border-[#c9ff3c]",
                )}
              >
                {step.done ? <Check className="size-4" /> : i + 1}
              </span>
              <span>
                <span className={cn("block text-sm font-semibold", step.done && "text-muted-foreground line-through")}>{step.label}</span>
                <span className="block text-xs text-muted-foreground">{step.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
