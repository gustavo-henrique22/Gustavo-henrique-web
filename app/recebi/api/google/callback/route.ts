import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, GOOGLE_ONLY_PASSWORD, isAdminEmail } from "@/lib/recebi/auth";
import { APP_PATH, BASE_PATH } from "@/lib/recebi/config";
import { fetchGoogleProfile, GOOGLE_STATE_COOKIE, googleEnabled } from "@/lib/recebi/google";
import { sendWelcomeEmail } from "@/lib/recebi/notifications";
import { siteOrigin } from "@/lib/recebi/origin";
import { applyReferral, REFERRAL_COOKIE } from "@/lib/recebi/referral";

export const dynamic = "force-dynamic";

/** Retorno do Google: encontra ou cria a conta e inicia a sessão. */
export async function GET(request: Request) {
  const origin = await siteOrigin();
  const fail = (motivo: string) => Response.redirect(`${origin}${BASE_PATH}/entrar?erro=${motivo}`, 302);
  if (!googleEnabled()) return fail("google");

  const url = new URL(request.url);
  const jar = await cookies();
  const expected = jar.get(GOOGLE_STATE_COOKIE)?.value;
  jar.delete({ name: GOOGLE_STATE_COOKIE, path: "/recebi/api/google" });
  const code = url.searchParams.get("code");
  if (!code || !expected || url.searchParams.get("state") !== expected) return fail("google");

  const profile = await fetchGoogleProfile(origin, code);
  if (!profile || !profile.emailVerified) return fail("google");

  const db = getDb();
  let [user] = await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1);
  let isNew = false;
  if (!user) {
    [user] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
    if (user) {
      // O e-mail já tinha conta com senha: vinculamos o Google a ela (o Google confirmou o e-mail).
      await db.update(users).set({ googleSub: profile.sub }).where(eq(users.id, user.id));
    } else {
      const id = crypto.randomUUID();
      await db.insert(users).values({
        id,
        name: profile.name.slice(0, 120),
        email: profile.email,
        passwordHash: GOOGLE_ONLY_PASSWORD,
        googleSub: profile.sub,
        isAdmin: await isAdminEmail(profile.email),
      });
      const referralCode = jar.get(REFERRAL_COOKIE)?.value;
      if (referralCode) {
        await applyReferral({ id, name: profile.name, email: profile.email }, referralCode);
        jar.delete({ name: REFERRAL_COOKIE, path: BASE_PATH });
      }
      [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      isNew = true;
    }
  }

  await createSession(user.id);
  if (isNew) await sendWelcomeEmail(user);
  return Response.redirect(`${origin}${APP_PATH}${isNew ? "?bem-vindo=1" : ""}`, 302);
}
