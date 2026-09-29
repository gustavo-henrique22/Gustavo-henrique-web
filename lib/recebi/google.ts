// Login com Google (OAuth 2.0 / OpenID Connect). Ativo quando GOOGLE_CLIENT_ID e
// GOOGLE_CLIENT_SECRET existem. No Google Cloud, cadastre o endereço de retorno
// https://SEU-SITE/recebi/api/google/callback.
import { readEnv } from "./email";

export const GOOGLE_STATE_COOKIE = "recebi_google_state";
export const GOOGLE_CALLBACK_PATH = "/recebi/api/google/callback";

export function googleEnabled(): boolean {
  return !!readEnv("GOOGLE_CLIENT_ID") && !!readEnv("GOOGLE_CLIENT_SECRET");
}

export function googleAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: readEnv("GOOGLE_CLIENT_ID") ?? "",
    redirect_uri: `${origin}${GOOGLE_CALLBACK_PATH}`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name: string };

/** Troca o código pelo perfil da pessoa. Devolve null se algo falhar. */
export async function fetchGoogleProfile(origin: string, code: string): Promise<GoogleProfile | null> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: readEnv("GOOGLE_CLIENT_ID") ?? "",
      client_secret: readEnv("GOOGLE_CLIENT_SECRET") ?? "",
      redirect_uri: `${origin}${GOOGLE_CALLBACK_PATH}`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return null;
  const { access_token } = (await tokenResponse.json()) as { access_token?: string };
  if (!access_token) return null;

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!profileResponse.ok) return null;
  const profile = (await profileResponse.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!profile.sub || !profile.email) return null;
  return {
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    emailVerified: profile.email_verified === true,
    name: profile.name ?? profile.email.split("@")[0],
  };
}
