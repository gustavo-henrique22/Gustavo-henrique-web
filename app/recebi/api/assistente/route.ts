import type Anthropic from "@anthropic-ai/sdk";
import {
  AI_BETAS,
  AI_MODEL,
  ASSISTANT_SYSTEM,
  aiClient,
  aiEnabled,
  aiErrorMessage,
  buildFinanceContext,
  takeAiQuota,
} from "@/lib/recebi/ai";
import { getAccount } from "@/lib/recebi/auth";

export const dynamic = "force-dynamic";

const MAX_TURNS = 12;
const MAX_CHARS = 2000;

type ChatTurn = { role: "user" | "assistant"; content: string };

function parseTurns(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const turns = value.slice(-MAX_TURNS).map((raw) => {
    const turn = raw as Record<string, unknown>;
    const role = turn?.role === "assistant" ? "assistant" : turn?.role === "user" ? "user" : null;
    const content = typeof turn?.content === "string" ? turn.content.trim().slice(0, MAX_CHARS) : "";
    return role && content ? { role, content } : null;
  });
  if (turns.some((t) => !t)) return null;
  const clean = turns as ChatTurn[];
  // A conversa precisa começar e terminar com a pessoa.
  while (clean.length && clean[0].role !== "user") clean.shift();
  if (!clean.length || clean[clean.length - 1].role !== "user") return null;
  return clean;
}

/** Linhas JSON: {"t":"text","v":"..."} | {"t":"reset"} | {"t":"error","v":"..."} | {"t":"done"} */
function line(event: Record<string, string>) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request) {
  // Só aceita JSON: formulários de outros sites não conseguem enviar este tipo sem permissão (CORS).
  if (!request.headers.get("content-type")?.includes("application/json")) return new Response("Tipo inválido", { status: 415 });
  const user = await getAccount();
  if (!user) return Response.json({ error: "Entre na sua conta para usar o assistente." }, { status: 401 });
  if (!aiEnabled()) return Response.json({ error: "O assistente ainda não foi ativado neste site." }, { status: 503 });

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const turns = parseTurns(body.messages);
  if (!turns) return Response.json({ error: "Escreva sua pergunta." }, { status: 400 });

  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await takeAiQuota(user, ip))) {
    return Response.json({ error: "Você chegou ao limite de perguntas de hoje. Amanhã tem mais!" }, { status: 429 });
  }

  const context = await buildFinanceContext(user);
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t) => ({ role: t.role, content: t.content }));

  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = aiClient().beta.messages.stream({
          model: AI_MODEL,
          max_tokens: 16000,
          betas: AI_BETAS,
          fallbacks: "default",
          output_config: { effort: "low" },
          system: [
            { type: "text", text: ASSISTANT_SYSTEM },
            { type: "text", text: `Resumo atual da conta:\n\n${context}` },
          ],
          messages,
        });
        for await (const event of stream) {
          if (event.type === "content_block_start" && event.content_block.type === "fallback") {
            // O modelo principal recusou e outro modelo assumiu: a resposta recomeça.
            controller.enqueue(line({ t: "reset" }));
          } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(line({ t: "text", v: event.delta.text }));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(line({ t: "reset" }));
          controller.enqueue(
            line({ t: "error", v: "Não consigo ajudar com esse pedido. Tente perguntar de outro jeito sobre suas finanças." }),
          );
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(line({ t: "text", v: "…" }));
        }
        controller.enqueue(line({ t: "done" }));
      } catch (error) {
        console.error("assistente", error);
        controller.enqueue(line({ t: "error", v: aiErrorMessage(error) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body$, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
