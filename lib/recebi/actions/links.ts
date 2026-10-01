"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { invoices, quotes } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { logEvent } from "../activity";
import { requireUser } from "../auth";
import { APP_PATH } from "../config";
import { randomToken } from "../crypto";
import { logSecurityEvent } from "../security";

/** Cobrança ("cobranca") ou orçamento ("orcamento") da pessoa logada. */
function target(formData: FormData) {
  const kind = text(formData, "kind", 20) === "orcamento" ? "orcamento" : "cobranca";
  const table = kind === "orcamento" ? quotes : invoices;
  const path = `${APP_PATH}/${kind === "orcamento" ? "orcamentos" : "cobrancas"}/`;
  return { kind, table, id: text(formData, "id", 64), path } as const;
}

/** Desativa ou reativa o link público (o cliente deixa de conseguir abrir). */
export async function setPublicLinkEnabled(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { kind, table, id, path } = target(formData);
  const enable = text(formData, "enable", 2) === "1";
  const updated = await getDb()
    .update(table)
    .set({ linkDisabledAt: enable ? null : new Date().toISOString() })
    .where(and(eq(table.id, id), eq(table.userId, user.id)))
    .returning({ number: table.number });
  if (updated.length === 0) return fail("Documento não encontrado.");
  await logEvent(user.id, kind, id, enable ? "link-reativado" : "link-desativado");
  if (!enable)
    await logSecurityEvent(user.id, "link-desativado", `${kind === "orcamento" ? "Orçamento" : "Cobrança"} #${updated[0].number}`);
  revalidatePath(`${path}${id}`);
  return success(
    enable ? "Link reativado. O cliente consegue abrir de novo." : "Link desativado. Ninguém consegue abrir pelo endereço antigo.",
  );
}

/** Gera um endereço novo: o antigo para de funcionar na hora. */
export async function regeneratePublicLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { kind, table, id, path } = target(formData);
  const updated = await getDb()
    .update(table)
    .set({ publicToken: randomToken(18), linkDisabledAt: null })
    .where(and(eq(table.id, id), eq(table.userId, user.id)))
    .returning({ number: table.number });
  if (updated.length === 0) return fail("Documento não encontrado.");
  await logEvent(user.id, kind, id, "link-trocado");
  await logSecurityEvent(user.id, "link-trocado", `${kind === "orcamento" ? "Orçamento" : "Cobrança"} #${updated[0].number}`);
  revalidatePath(`${path}${id}`);
  return success("Link novo gerado. Envie o endereço novo ao cliente; o antigo não funciona mais.");
}
