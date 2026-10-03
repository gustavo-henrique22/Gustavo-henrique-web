import { KeyRound, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { AssistantChat } from "@/components/recebi/assistant-chat";
import { PageHeader } from "@/components/recebi/page-header";
import { aiDailyLimit, aiEnabled } from "@/lib/recebi/ai";
import { hasPro, requireUser } from "@/lib/recebi/auth";

export const metadata: Metadata = { title: "Assistente" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const enabled = aiEnabled();

  return (
    <>
      <PageHeader
        title="Assistente"
        description={
          hasPro(user)
            ? "Pergunte em português e receba respostas com os números da sua conta."
            : `No plano Grátis são ${aiDailyLimit(user)} perguntas por dia. No Pro, ${aiDailyLimit({ ...user, plan: "pro", planExpiresAt: null })}.`
        }
      />
      {enabled ? (
        <AssistantChat
          firstName={user.name.split(" ")[0]}
          dailyLimit={aiDailyLimit(user)}
          initialQuestion={q?.trim().slice(0, 500) || undefined}
        />
      ) : (
        <section className="grid place-items-center gap-3 rounded-2xl border border-dashed bg-card p-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-muted">
            <Sparkles className="size-7" />
          </span>
          <h2 className="text-lg font-bold">O assistente ainda não foi ativado neste site</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Ele responde perguntas sobre suas finanças e monta orçamentos com inteligência artificial.
          </p>
          {user.isAdmin ? (
            <p className="flex max-w-md items-start gap-2 rounded-xl bg-muted/60 p-3 text-left text-xs text-muted-foreground">
              <KeyRound className="mt-0.5 size-4 shrink-0" /> Para ativar, crie uma chave em console.anthropic.com e cadastre como segredo
              ANTHROPIC_API_KEY nas configurações do site.
            </p>
          ) : null}
        </section>
      )}
    </>
  );
}
