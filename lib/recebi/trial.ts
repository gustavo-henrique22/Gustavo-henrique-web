// Teste grátis do Pro: toda conta nova começa com TRIAL_DAYS dias de Pro (convidados ganham REFERRED_TRIAL_DAYS).
import type { User } from "@/db/schema";
import { addDays, daysBetween, todayISO } from "./dates";

export const TRIAL_DAYS = 7;

/** Campos para gravar numa conta nova. */
export function trialFields(days = TRIAL_DAYS) {
  const end = addDays(todayISO(), days);
  return { plan: "pro" as const, planExpiresAt: end, trialEndsAt: end };
}

/** Está no teste grátis (ainda não pagou)? */
export function onTrial(user: Pick<User, "plan" | "planExpiresAt" | "trialEndsAt">): boolean {
  return user.plan === "pro" && !!user.trialEndsAt && user.planExpiresAt === user.trialEndsAt && user.trialEndsAt >= todayISO();
}

export function trialDaysLeft(user: Pick<User, "trialEndsAt">): number {
  return user.trialEndsAt ? Math.max(0, daysBetween(todayISO(), user.trialEndsAt)) : 0;
}
