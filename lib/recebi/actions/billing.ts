"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { externalPayments } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { normalizeEmail, requireActor } from "../auth";
import { billingEnabled, createCheckout, PRO_PLANS, type ProPlanKey } from "../billing";
import { APP_PATH } from "../config";
import { assignExternalPayment } from "../external-billing";
import { siteOrigin } from "../origin";
import { takeRateLimit } from "../rate-limit";

/** Leva a pessoa para o pagamento do plano Pro no Mercado Pago. */
export async function startCheckout(formData: FormData): Promise<void> {
  const user = await requireActor();
  const plan = String(formData.get("plan") ?? "") as ProPlanKey;
  if (user.isDemo || !billingEnabled() || !(plan in PRO_PLANS)) redirect(`${APP_PATH}/plano`);
  const url = await createCheckout(user, plan, await siteOrigin());
  redirect(url ?? `${APP_PATH}/plano?pagamento=erro`);
}

/** "Paguei com outro e-mail": a pessoa informa o número do pedido e o e-mail usado no pagamento. */
export async function claimExternalPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireActor();
  if (user.isDemo) return fail("Crie sua conta para assinar o Pro.");
  const orderId = text(formData, "orderId", 120).replace(/^#/, "");
  const email = normalizeEmail(text(formData, "email", 200));
  if (!orderId || !email) return fail("Informe o número do pedido e o e-mail usado no pagamento.");
  if (!(await takeRateLimit(`claim:${user.id}`, 10, 3_600_000))) return fail("Muitas tentativas. Tente de novo em uma hora.");

  const [row] = await getDb()
    .select({ id: externalPayments.id })
    .from(externalPayments)
    .where(
      and(
        eq(externalPayments.externalId, orderId),
        eq(externalPayments.email, email),
        isNull(externalPayments.userId),
        isNull(externalPayments.handledAt),
      ),
    )
    .limit(1);
  if (!row || !(await assignExternalPayment(row.id, user))) {
    return fail("Não encontramos esse pagamento ainda. Confira os dados ou espere alguns minutos e tente de novo.");
  }
  revalidatePath(APP_PATH, "layout");
  return success("Pagamento encontrado! Seu Pro está ativo. ✨");
}
