"use server";

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { requestIp } from "../activity";
import { AI_BETAS, AI_MODEL, QUOTE_SYSTEM, aiClient, aiEnabled, aiErrorMessage, buildQuoteContext, takeAiQuota } from "../ai";
import { requireUser } from "../auth";

const QuoteSuggestion = z.object({
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPriceCents: z.number().int(),
    }),
  ),
  notes: z.string(),
  summary: z.string(),
});

export type SuggestedQuote = {
  items: { description: string; quantity: number; unitPriceCents: number }[];
  notes: string;
  summary: string;
};

/** Monta os itens de um orçamento a partir de uma descrição curta do trabalho. */
export async function suggestQuote(brief: string): Promise<SuggestedQuote | { error: string }> {
  const user = await requireUser();
  if (!aiEnabled()) return { error: "O assistente com IA ainda não foi ativado neste site." };
  const text = brief.trim().slice(0, 3000);
  if (text.length < 10) return { error: "Descreva o trabalho em pelo menos uma frase." };
  if (!(await takeAiQuota(user, (await requestIp()) || "local")))
    return { error: "Você chegou ao limite de uso da IA de hoje. Amanhã tem mais!" };

  try {
    const response = await aiClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: AI_BETAS,
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(QuoteSuggestion) },
      system: [
        { type: "text", text: QUOTE_SYSTEM },
        { type: "text", text: await buildQuoteContext(user) },
      ],
      messages: [{ role: "user", content: `Pedido do cliente / descrição do trabalho:\n"""\n${text}\n"""` }],
    });
    if (response.stop_reason === "refusal")
      return { error: "Não consegui montar esse orçamento. Tente descrever o trabalho de outro jeito." };
    const parsed = response.parsed_output;
    if (!parsed || parsed.items.length === 0)
      return { error: "A IA não conseguiu sugerir itens. Tente detalhar um pouco mais o trabalho." };
    return {
      items: parsed.items.slice(0, 15).map((item) => ({
        description: item.description.trim().slice(0, 200),
        quantity: Math.min(Math.max(Math.round(item.quantity * 100) / 100, 0.01), 1000),
        unitPriceCents: Math.min(Math.max(Math.round(item.unitPriceCents), 0), 100_000_000_00),
      })),
      notes: parsed.notes.trim().slice(0, 2000),
      summary: parsed.summary.trim().slice(0, 400),
    };
  } catch (error) {
    console.error("orcamento-ia", error);
    return { error: aiErrorMessage(error) };
  }
}
