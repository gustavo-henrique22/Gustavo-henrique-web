import { cookies } from "next/headers";
import { randomToken } from "@/lib/recebi/crypto";
import { GOOGLE_STATE_COOKIE, googleAuthUrl, googleEnabled } from "@/lib/recebi/google";
import { siteOrigin } from "@/lib/recebi/origin";

export const dynamic = "force-dynamic";

/** Começa o login com Google. */
export async function GET() {
  if (!googleEnabled()) return new Response("Login com Google não configurado.", { status: 404 });
  const state = randomToken(24);
  (await cookies()).set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/recebi/api/google",
    maxAge: 600,
  });
  return Response.redirect(googleAuthUrl(await siteOrigin(), state), 302);
}
