"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { coupons } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { logAdminAction, requireAdminAction } from "../admin-guard";
import { requireActor } from "../auth";
import { APP_PATH } from "../config";
import { normalizeCode, redeemCoupon } from "../coupons";
import { formatDate } from "../dates";
import { takeRateLimit } from "../rate-limit";

/** A pessoa digita um cupom na página do plano. */
export async function applyCoupon(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireActor();
  if (user.isDemo) return fail("Crie sua conta para usar cupons.");
  if (!(await takeRateLimit(`cupom:${user.id}`, 10, 60 * 60_000))) return fail("Muitas tentativas. Tente de novo mais tarde.");
  const result = await redeemCoupon(user, text(formData, "code", 40));
  if (!result.ok) return fail(result.error);
  revalidatePath(APP_PATH, "layout");
  if (result.coupon.kind === "desconto") {
    return success(`Cupom ${result.coupon.code} aplicado! O desconto já vai no link de pagamento.`);
  }
  return success(`Cupom aplicado! Seu Pro vale até ${formatDate(result.until ?? "")}. ✨`);
}

/** Admin: cria um cupom. */
export async function createCoupon(_: ActionState, formData: FormData): Promise<ActionState> {
  const { admin, error } = await requireAdminAction();
  if (!admin) return fail(error);
  const code = normalizeCode(text(formData, "code", 40));
  const kind = text(formData, "kind", 10) === "desconto" ? "desconto" : "dias";
  const days = Math.floor(Number(text(formData, "days", 4)) || 0);
  const maxUses = Math.max(0, Math.floor(Number(text(formData, "maxUses", 6)) || 0));
  const expiresAt = text(formData, "expiresAt", 10);
  if (code.length < 3) return fail("O código precisa de pelo menos 3 letras ou números.");
  if (kind === "dias" && (days < 1 || days > 366)) return fail("Informe de 1 a 366 dias de Pro.");
  if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return fail("Data de validade inválida.");
  const inserted = await getDb()
    .insert(coupons)
    .values({
      id: crypto.randomUUID(),
      code,
      kind,
      days: kind === "dias" ? days : 0,
      description: text(formData, "description", 120),
      maxUses,
      expiresAt: expiresAt || null,
      winback: formData.get("winback") === "on",
    })
    .onConflictDoNothing()
    .returning({ id: coupons.id });
  if (inserted.length === 0) return fail("Já existe um cupom com esse código.");
  await logAdminAction(admin, "cupom-criado", "", `${code} (${kind === "dias" ? `${days} dias` : "desconto"})`);
  revalidatePath(`${APP_PATH}/admin`);
  return success(`Cupom ${code} criado.`);
}

/** Admin: liga ou desliga um cupom. */
export async function toggleCoupon(_: ActionState, formData: FormData): Promise<ActionState> {
  const { admin, error } = await requireAdminAction();
  if (!admin) return fail(error);
  const active = text(formData, "active", 5) === "1";
  const [row] = await getDb()
    .update(coupons)
    .set({ active })
    .where(eq(coupons.id, text(formData, "id", 64)))
    .returning({ code: coupons.code });
  if (!row) return fail("Cupom não encontrado.");
  await logAdminAction(admin, active ? "cupom-ativado" : "cupom-desativado", "", row.code);
  revalidatePath(`${APP_PATH}/admin`);
  return success(active ? `Cupom ${row.code} ativado.` : `Cupom ${row.code} desativado.`);
}
