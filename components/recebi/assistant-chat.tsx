"use client";

import { ArrowUp, RotateCcw, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MiniMarkdown } from "./mini-markdown";

type Turn = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGGESTIONS = [
  "Quanto eu lucrei este ano?",
  "Quem está me devendo?",
  "Onde estou gastando mais?",
  "Quanto separar para impostos este mês?",
  "Consigo tirar férias no próximo mês?",
  "Como está minha meta?",
];

export function AssistantChat({
  firstName,
  dailyLimit,
  initialQuestion,
}: {
  firstName: string;
  dailyLimit: number;
  initialQuestion?: string;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history = [...turns.filter((t) => !t.error), { role: "user" as const, content: text }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    let answer = "";
    const show = (content: string, error = false) => setTurns((list) => [...list.slice(0, -1), { role: "assistant", content, error }]);

    try {
      const response = await fetch("/recebi/api/assistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        show(data?.error ?? "Não foi possível falar com o assistente agora.", true);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { t: string; v?: string };
          if (event.t === "text") answer += event.v ?? "";
          else if (event.t === "reset") answer = "";
          else if (event.t === "error") {
            show(event.v ?? "Algo deu errado.", true);
            return;
          }
        }
        show(answer);
      }
      if (!answer) show("Não recebi resposta. Tente de novo.", true);
    } catch (error) {
      if ((error as Error).name === "AbortError") show(answer || "Resposta interrompida.", !answer);
      else show("A conexão caiu. Tente de novo.", true);
    } finally {
      setBusy(false);
      abort.current = null;
      textarea.current?.focus();
    }
  }

  // Pergunta vinda do painel (?q=...): envia uma vez ao abrir.
  useEffect(() => {
    if (!initialQuestion || asked.current) return;
    asked.current = true;
    const id = setTimeout(() => void send(initialQuestion), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      {turns.length === 0 ? (
        <div className="grid flex-1 place-content-center gap-6 py-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#101c34] text-[#c9ff3c] shadow-lg dark:bg-[#c9ff3c] dark:text-[#101c34]">
            <Sparkles className="size-8" />
          </span>
          <div>
            <h2 className="text-2xl font-extrabold">Oi, {firstName}! Pergunte sobre seu dinheiro.</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Eu olho seus lançamentos, cobranças, orçamentos e previsões para responder com os seus números.
            </p>
          </div>
          <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-xs transition hover:-translate-y-0.5 hover:border-foreground/30"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid flex-1 content-start gap-4 pb-6" aria-live="polite">
          {turns.map((turn, i) =>
            turn.role === "user" ? (
              <div
                key={i}
                className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#101c34] px-4 py-3 text-sm text-white dark:bg-[#c9ff3c] dark:text-[#101c34]"
              >
                {turn.content}
              </div>
            ) : (
              <div key={i} className="flex max-w-[92%] gap-3">
                <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-[#c9ff3c] text-[#101c34]">
                  <Sparkles className="size-4" />
                </span>
                <div
                  className={cn(
                    "min-w-0 rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-sm shadow-xs",
                    turn.error && "border-destructive/40 text-destructive",
                  )}
                >
                  {turn.content ? (
                    <MiniMarkdown text={turn.content} />
                  ) : (
                    <span className="flex items-center gap-1 py-1" aria-label="Pensando">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="size-2 animate-bounce rounded-full bg-muted-foreground/60"
                          style={{ animationDelay: `${d * 150}ms` }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ),
          )}
          <div ref={bottom} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-3 rounded-2xl border bg-card p-2 shadow-lg"
      >
        <div className="flex items-end gap-2">
          <label htmlFor="assistant-input" className="sr-only">
            Sua pergunta
          </label>
          <textarea
            ref={textarea}
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Pergunte qualquer coisa sobre suas finanças…"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none field-sizing-content"
          />
          {busy ? (
            <Button type="button" size="icon" variant="outline" aria-label="Parar resposta" onClick={() => abort.current?.abort()}>
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" aria-label="Enviar pergunta" disabled={!input.trim()}>
              <ArrowUp />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-3 pt-1 text-[0.7rem] text-muted-foreground">
          <span>Até {dailyLimit} perguntas por dia · confira números importantes antes de decidir.</span>
          {turns.length > 0 && !busy ? (
            <button
              type="button"
              onClick={() => setTurns([])}
              className="inline-flex items-center gap-1 font-semibold hover:text-foreground"
            >
              <RotateCcw className="size-3" /> Nova conversa
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
