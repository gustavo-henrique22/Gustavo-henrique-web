import { headers } from "next/headers";
import { readEnv } from "./email";

/**
 * Endereço público do site (ex.: https://meusite.com), usado em links compartilháveis e e-mails.
 * RECEBI_SITE_URL tem prioridade (recomendado em produção); sem ela, usamos o Host da requisição atual.
 */
export async function siteOrigin(): Promise<string> {
  const configured = readEnv("RECEBI_SITE_URL");
  if (configured) return configured.replace(/\/+$/, "");
  try {
    const h = await headers();
    // Usamos o Host da requisição, que a Cloudflare usa para rotear. Não confiamos em X-Forwarded-Host:
    // qualquer pessoa pode mandar esse cabeçalho e desviar links de e-mail (ex.: redefinição de senha).
    const host = h.get("host") ?? "localhost";
    const proto = /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";
    return `${proto}://${host}`;
  } catch {
    return "";
  }
}

export function siteUrlConfigured(): boolean {
  return !!readEnv("RECEBI_SITE_URL");
}
