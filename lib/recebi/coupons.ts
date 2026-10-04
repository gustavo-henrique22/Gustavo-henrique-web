// Cupons do plano Pro, criados pelo admin.
// "dias": a pessoa digita o código e ganha dias de Pro na hora (uma vez por conta).
// "desconto": o código vai junto no link de pagamento da Kiwify/Shopify (crie o mesmo cupom lá).
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { couponRedemptions, coupons, users, type Coupon, type User } from "@/db/schema";
import { normalizeCode } from "./coupon-code";
import { addDays, todayISO } from "./dates";

export { normalizeCode };

export async function listCoupons(): Promise<Coupon[]> {
  return getDb().select().from(coupons).orderBy(desc(coupons.createdAt)).limit(100);
}

/** Cupom válido hoje (ativo, dentro do prazo e com usos sobrando), ou null. */
export async function findValidCoupon(code: string): Promise<Coupon | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const [coupon] = await getDb().select().from(coupons).where(eq(coupons.code, normalized)).limit(1);
  if (!coupon || !coupon.active) return null;
  if (coupon.expiresAt && coupon.expiresAt < todayISO()) return null;
  if (coupon.maxUses > 0 && coupon.uses >= coupon.maxUses) return null;
  return coupon;
}

/** Cupom ativo marcado para o e-mail "sentimos sua falta". */
export async function winbackCoupon(): Promise<Coupon | null> {
  const today = todayISO();
  const rows = await getDb()
    .select()
    .from(coupons)
    .where(and(eq(coupons.active, true), eq(coupons.winback, true)))
    .orderBy(desc(coupons.createdAt))
    .limit(5);
  return rows.find((c) => (!c.expiresAt || c.expiresAt >= today) && (c.maxUses === 0 || c.uses < c.maxUses)) ?? null;
}

export type RedeemResult = { ok: true; coupon: Coupon; until?: string } | { ok: false; error: string };

/** Usa o cupom na conta. */
export async function redeemCoupon(user: Pick<User, "id" | "plan" | "planExpiresAt">, code: string): Promise<RedeemResult> {
  const coupon = await findValidCoupon(code);
  if (!coupon) return { ok: false, error: "Cupom inválido ou vencido." };
  const db = getDb();
  if (coupon.kind === "desconto") {
    await db.update(users).set({ checkoutCoupon: coupon.code }).where(eq(users.id, user.id));
    return { ok: true, coupon };
  }
  // Uma vez por conta: a chave única barra o segundo uso.
  const inserted = await db
    .insert(couponRedemptions)
    .values({ id: crypto.randomUUID(), couponId: coupon.id, userId: user.id })
    .onConflictDoNothing()
    .returning({ id: couponRedemptions.id });
  if (inserted.length === 0) return { ok: false, error: "Você já usou este cupom." };
  // Reserva o uso só se ainda houver vaga (evita passar do limite com dois usos ao mesmo tempo).
  const updated = await db
    .update(coupons)
    .set({ uses: sql`${coupons.uses} + 1` })
    .where(and(eq(coupons.id, coupon.id), sql`(${coupons.maxUses} = 0 or ${coupons.uses} < ${coupons.maxUses})`))
    .returning({ id: coupons.id });
  if (updated.length === 0) {
    await db.delete(couponRedemptions).where(eq(couponRedemptions.id, inserted[0].id));
    return { ok: false, error: "Este cupom esgotou." };
  }
  const today = todayISO();
  const base = user.plan === "pro" && user.planExpiresAt && user.planExpiresAt > today ? user.planExpiresAt : today;
  const until = addDays(base, coupon.days);
  await db.update(users).set({ plan: "pro", planExpiresAt: until }).where(eq(users.id, user.id));
  return { ok: true, coupon, until };
}

/** Conta um uso de cupom de desconto quando o pagamento com ele é aprovado. */
export async function countDiscountUse(code: string): Promise<void> {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  await getDb()
    .update(coupons)
    .set({ uses: sql`${coupons.uses} + 1` })
    .where(and(eq(coupons.code, normalized), eq(coupons.kind, "desconto")));
}
