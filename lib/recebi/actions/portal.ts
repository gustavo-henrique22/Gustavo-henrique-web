"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { hasPro, requireUser } from "../auth";
import { APP_PATH } from "../config";
import { randomToken } from "../crypto";

/** Cria (ou troca, invalidando o antigo) o link do portal do cliente. */
export async function regeneratePortalLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!hasPro(user)) return fail("O portal do cliente é um recurso do plano Pro.");
  const id = text(formData, "clientId", 64);
  const off = text(formData, "off", 1) === "1";
  const updated = await getDb()
    .update(clients)
    .set({ portalToken: off ? null : randomToken(24) })
    .where(and(eq(clients.id, id), eq(clients.userId, user.id)))
    .returning({ id: clients.id });
  if (updated.length === 0) return fail("Cliente não encontrado.");
  revalidatePath(`${APP_PATH}/clientes/${id}`);
  return success(off ? "Portal desativado. O link antigo não abre mais." : "Novo link do portal criado.");
}
