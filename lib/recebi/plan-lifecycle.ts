// Avisos do ciclo do plano Pro, enviados pelas tarefas diárias:
// - 3 dias antes de o Pro (ou o teste grátis) vencer: lembrete para renovar;
// - 7 dias depois de vencer sem renovar: "sentimos sua falta", com o cupom de volta (se o admin criou um).
// Cada aviso sai uma vez só por vencimento (marcado nas notificações da conta).
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, users, type User } from "@/db/schema";
import { notify } from "./activity";
import { APP_PATH } from "./config";
import { winbackCoupon } from "./coupons";
import { addDays, formatDate, todayISO } from "./dates";
import { emailEnabled, emailLayout, escapeHtml, sendEmail } from "./email";
import { siteOrigin } from "./origin";

const BEFORE_DAYS = 3;
const WINBACK_AFTER_DAYS = 7;

async function alreadySent(type: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await getDb()
    .select({ userId: notifications.userId })
    .from(notifications)
    .where(and(eq(notifications.type, type), inArray(notifications.userId, userIds)));
  return new Set(rows.map((r) => r.userId));
}

async function expiringOn(date: string): Promise<User[]> {
  return getDb()
    .select()
    .from(users)
    .where(and(eq(users.plan, "pro"), eq(users.planExpiresAt, date), eq(users.isDemo, false)))
    .limit(500);
}

export async function sendPlanReminders(): Promise<{ reminders: number; winback: number }> {
  const today = todayISO();
  const origin = await siteOrigin();
  let reminders = 0;
  let winback = 0;

  // 1) Vence em 3 dias.
  const soonDate = addDays(today, BEFORE_DAYS);
  const soon = await expiringOn(soonDate);
  const soonType = `pro-vence:${soonDate}`;
  const soonSent = await alreadySent(
    soonType,
    soon.map((u) => u.id),
  );
  for (const user of soon) {
    if (soonSent.has(user.id)) continue;
    const trial = user.trialEndsAt === user.planExpiresAt;
    await notify(user.id, {
      type: soonType,
      title: trial ? "Seu teste grátis do Pro acaba em 3 dias" : "Seu Pro vence em 3 dias",
      body: `Válido até ${formatDate(soonDate)}. Renove para não perder os recursos do Pro.`,
      href: `${APP_PATH}/plano`,
    });
    if (emailEnabled()) {
      await sendEmail({
        to: user.email,
        subject: trial ? "Seu teste grátis do Recebi Pro acaba em 3 dias" : "Seu Recebi Pro vence em 3 dias",
        html: emailLayout({
          preheader: `Válido até ${formatDate(soonDate)}.`,
          title: trial ? "Seu teste grátis está acabando" : "Seu Pro está perto de vencer",
          paragraphs: [
            `Oi, ${escapeHtml(user.name.split(" ")[0])}! Seu plano Pro vale até <strong>${formatDate(soonDate)}</strong>.`,
            "Depois disso, a conta volta para o plano Grátis: os dados continuam lá, mas lembretes automáticos, recorrências, relatórios completos e os limites ilimitados param.",
          ],
          cta: { label: trial ? "Continuar com o Pro" : "Renovar o Pro", url: `${origin}${APP_PATH}/plano` },
        }),
      }).catch((error) => console.error("aviso-vencimento", error));
    }
    reminders++;
  }

  // 2) Venceu há 7 dias e não renovou.
  const lostDate = addDays(today, -WINBACK_AFTER_DAYS);
  const lost = await expiringOn(lostDate);
  const lostType = `pro-saudade:${lostDate}`;
  const lostSent = await alreadySent(
    lostType,
    lost.map((u) => u.id),
  );
  const coupon = lost.length > 0 ? await winbackCoupon() : null;
  for (const user of lost) {
    if (lostSent.has(user.id)) continue;
    const offer = coupon
      ? coupon.kind === "dias"
        ? `Use o cupom <strong>${escapeHtml(coupon.code)}</strong> e ganhe ${coupon.days} dias de Pro grátis.`
        : `Use o cupom <strong>${escapeHtml(coupon.code)}</strong> e ganhe desconto na assinatura${coupon.description ? ` (${escapeHtml(coupon.description)})` : ""}.`
      : "";
    await notify(user.id, {
      type: lostType,
      title: "Sentimos sua falta no Pro",
      body: coupon ? `Volte com o cupom ${coupon.code}.` : "Seus dados continuam guardados. Volte quando quiser.",
      href: `${APP_PATH}/plano${coupon ? `?cupom=${encodeURIComponent(coupon.code)}` : ""}`,
    });
    if (emailEnabled()) {
      await sendEmail({
        to: user.email,
        subject: "Sentimos sua falta no Recebi Pro",
        html: emailLayout({
          preheader: coupon ? `Um presente para você voltar: ${coupon.code}` : "Seus dados continuam guardados.",
          title: "Sentimos sua falta 💚",
          paragraphs: [
            `Oi, ${escapeHtml(user.name.split(" ")[0])}! Seu Pro venceu em ${formatDate(lostDate)} e sua conta voltou para o plano Grátis.`,
            "Tudo continua guardado: clientes, cobranças e relatórios. É só voltar para ter de novo lembretes automáticos, recorrências e tudo ilimitado.",
            ...(offer ? [offer] : []),
          ],
          cta: {
            label: "Voltar para o Pro",
            url: `${origin}${APP_PATH}/plano${coupon ? `?cupom=${encodeURIComponent(coupon.code)}` : ""}`,
          },
        }),
      }).catch((error) => console.error("email-saudade", error));
    }
    winback++;
  }
  return { reminders, winback };
}
