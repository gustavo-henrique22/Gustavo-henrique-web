"use server";

import { redirect } from "next/navigation";
import { requireUser } from "../auth";
import { billingEnabled, createCheckout, PRO_PLANS, type ProPlanKey } from "../billing";
import { APP_PATH } from "../config";
import { siteOrigin } from "../origin";

/** Leva a pessoa para o pagamento do plano Pro no Mercado Pago. */
export async function startCheckout(formData: FormData): Promise<void> {
  const user = await requireUser();
  const plan = String(formData.get("plan") ?? "") as ProPlanKey;
  if (user.isDemo || !billingEnabled() || !(plan in PRO_PLANS)) redirect(`${APP_PATH}/plano`);
  const url = await createCheckout(user, plan, await siteOrigin());
  redirect(url ?? `${APP_PATH}/plano?pagamento=erro`);
}
