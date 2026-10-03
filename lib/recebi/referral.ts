// "Indique e ganhe": quem é convidado ganha 7 dias de Pro; quem convidou ganha 1 mês de Pro
// quando o convidado assina (no máximo 12 meses por ano, para evitar abuso).
import { and, count, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { payments, referralRewards, users, type User } from "@/db/schema";
import { notify } from "./activity";
import { APP_PATH } from "./config";
import { addDays, addMonthsToDate, todayISO } from "./dates";
import { sendReferralRewardEmail } from "./notifications";
import { sqliteTimestamp } from "./rate-limit";

export const REFERRAL_COOKIE = "recebi_ref";
export const REFERRED_TRIAL_DAYS = 7;
export const REWARD_MONTHS = 1;
export const MAX_REWARDS_PER_YEAR = 12;

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function normalizeReferralCode(value: string | null | undefined): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function newCode(name: string): string {
  const letters = name
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, "X");
  const random = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${letters}${random}`;
}

/** Código de convite da pessoa (criado na primeira vez que ela precisa). */
export async function ensureReferralCode(user: Pick<User, "id" | "name" | "referralCode">): Promise<string> {
  if (user.referralCode) return user.referralCode;
  const db = getDb();
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newCode(user.name);
    try {
      await db.update(users).set({ referralCode: code }).where(eq(users.id, user.id));
      return code;
    } catch {
      // Código repetido (muito raro): tenta outro.
    }
  }
  throw new Error("Não foi possível gerar o código de convite.");
}

export async function findReferrer(code: string) {
  const normalized = normalizeReferralCode(code);
  if (normalized.length < 6) return null;
  const [row] = await getDb()
    .select({ id: users.id, name: users.name, isDemo: users.isDemo })
    .from(users)
    .where(eq(users.referralCode, normalized))
    .limit(1);
  return row && !row.isDemo ? row : null;
}

/** Liga a conta nova a quem convidou e dá os dias de Pro de presente. */
export async function applyReferral(newUser: Pick<User, "id" | "name" | "email">, code: string): Promise<boolean> {
  const referrer = await findReferrer(code);
  if (!referrer || referrer.id === newUser.id) return false;
  const db = getDb();
  const updated = await db
    .update(users)
    .set({ referredBy: referrer.id, plan: "pro", planExpiresAt: addDays(todayISO(), REFERRED_TRIAL_DAYS) })
    .where(and(eq(users.id, newUser.id), eq(users.isDemo, false)))
    .returning({ id: users.id });
  if (updated.length === 0) return false;
  await notify(referrer.id, {
    type: "indicacao",
    title: `${newUser.name.split(" ")[0]} criou conta com o seu convite 🎉`,
    body: "Quando assinar o Pro, você ganha 1 mês de Pro grátis.",
    href: `${APP_PATH}/indique`,
  });
  return true;
}

/** Na primeira assinatura paga de quem foi convidado, dá 1 mês de Pro para quem convidou. */
export async function grantReferralReward(referredUserId: string): Promise<boolean> {
  const db = getDb();
  const [referred] = await db
    .select({ id: users.id, name: users.name, referredBy: users.referredBy })
    .from(users)
    .where(eq(users.id, referredUserId))
    .limit(1);
  if (!referred?.referredBy) return false;
  const [referrer] = await db.select().from(users).where(eq(users.id, referred.referredBy)).limit(1);
  if (!referrer || referrer.isDemo) return false;

  const [{ total }] = await db
    .select({ total: count() })
    .from(referralRewards)
    .where(
      and(eq(referralRewards.referrerId, referrer.id), gte(referralRewards.createdAt, sqliteTimestamp(Date.now() - 365 * 86_400_000))),
    );
  if (total >= MAX_REWARDS_PER_YEAR) return false;

  const inserted = await db
    .insert(referralRewards)
    .values({ id: crypto.randomUUID(), referrerId: referrer.id, referredId: referred.id, months: REWARD_MONTHS })
    .onConflictDoNothing()
    .returning({ id: referralRewards.id });
  if (inserted.length === 0) return false;

  const { extendPro } = await import("./billing");
  const until = await extendPro(referrer, REWARD_MONTHS);
  const firstName = referred.name.split(" ")[0];
  await notify(referrer.id, {
    type: "indicacao",
    title: `Você ganhou 1 mês de Pro! ${firstName} assinou o Recebi`,
    body: `Seu Pro agora vale até ${until.split("-").reverse().join("/")}.`,
    href: `${APP_PATH}/indique`,
  });
  await sendReferralRewardEmail(referrer, firstName, until);
  return true;
}

export async function referralStats(userId: string) {
  const db = getDb();
  const [invited, rewards] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.referredBy, userId))
      .orderBy(desc(users.createdAt))
      .limit(100),
    db.select().from(referralRewards).where(eq(referralRewards.referrerId, userId)),
  ]);
  const paidIds = new Set(rewards.map((r) => r.referredId));
  // Quem pagou mas não gerou recompensa (limite anual) também aparece como "assinou".
  const paying = new Set(
    invited.length
      ? (
          await db
            .selectDistinct({ userId: payments.userId })
            .from(payments)
            .where(
              inArray(
                payments.userId,
                invited.map((i) => i.id),
              ),
            )
        ).map((p) => p.userId)
      : [],
  );
  return {
    invited: invited.map((person) => ({
      firstName: person.name.split(" ")[0],
      createdAt: person.createdAt,
      subscribed: paidIds.has(person.id) || paying.has(person.id),
    })),
    rewards: rewards.length,
    monthsEarned: rewards.reduce((sum, r) => sum + r.months, 0),
  };
}

/** Estorno do primeiro pagamento de um convidado: a recompensa de quem convidou é desfeita. */
export async function revokeReferralReward(referredUserId: string): Promise<boolean> {
  const db = getDb();
  // Só desfaz se o convidado não tiver mais nenhum pagamento válido.
  const valid = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.userId, referredUserId), ne(payments.status, "estornado")))
    .limit(1);
  if (valid.length > 0) return false;
  const removed = await db.delete(referralRewards).where(eq(referralRewards.referredId, referredUserId)).returning();
  const reward = removed[0];
  if (!reward) return false;
  const [referrer] = await db.select().from(users).where(eq(users.id, reward.referrerId)).limit(1);
  if (referrer?.plan === "pro" && referrer.planExpiresAt) {
    const today = todayISO();
    const reduced = addMonthsToDate(referrer.planExpiresAt, -reward.months);
    await db
      .update(users)
      .set({ planExpiresAt: reduced > today ? reduced : today })
      .where(eq(users.id, referrer.id));
  }
  return true;
}
