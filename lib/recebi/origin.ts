import { headers } from "next/headers";
import { readEnv } from "./email";

/**
 * Endereço público do site (ex.: https://meusite.com), usado em links compartilháveis e e-mails.
 * RECEBI_SITE_URL tem prioridade; sem ela, usamos o endereço da requisição atual.
 */
export async function siteOrigin(): Promise<string> {
  const configured = readEnv("RECEBI_SITE_URL");
  if (configured) return configured.replace(/\/+$/, "");
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
    const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return "";
  }
}
