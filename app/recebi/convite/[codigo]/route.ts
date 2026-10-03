import { cookies } from "next/headers";
import { BASE_PATH } from "@/lib/recebi/config";
import { siteOrigin } from "@/lib/recebi/origin";
import { findReferrer, normalizeReferralCode, REFERRAL_COOKIE } from "@/lib/recebi/referral";

export const dynamic = "force-dynamic";

/** Link de convite: guarda o código por 30 dias e leva para o cadastro. */
export async function GET(_: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const code = normalizeReferralCode((await params).codigo);
  const origin = await siteOrigin();
  if (!(await findReferrer(code))) return Response.redirect(`${origin}${BASE_PATH}/cadastro`, 302);
  (await cookies()).set(REFERRAL_COOKIE, code, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: BASE_PATH,
    maxAge: 30 * 86_400,
  });
  return Response.redirect(`${origin}${BASE_PATH}/cadastro?ref=${code}`, 302);
}
