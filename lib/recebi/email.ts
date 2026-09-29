// Envio de e-mails transacionais pelo Resend (https://resend.com).
// Só funciona quando as variáveis RESEND_API_KEY e RECEBI_EMAIL_FROM existem;
// sem elas, o app continua funcionando e o administrador gera links manualmente.
import { env } from "cloudflare:workers";

function readEnv(name: string): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" && value ? value : undefined;
}

export function emailEnabled(): boolean {
  return !!readEnv("RESEND_API_KEY") && !!readEnv("RECEBI_EMAIL_FROM");
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = readEnv("RESEND_API_KEY");
  const from = readEnv("RECEBI_EMAIL_FROM");
  if (!apiKey || !from) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
