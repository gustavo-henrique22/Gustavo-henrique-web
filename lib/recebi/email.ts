// Envio de e-mails transacionais pelo Resend (https://resend.com).
// Só funciona quando as variáveis RESEND_API_KEY e RECEBI_EMAIL_FROM existem;
// sem elas, o app continua funcionando e os envios são simplesmente ignorados.
import { env } from "cloudflare:workers";

export function readEnv(name: string): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" && value ? value : undefined;
}

export function emailEnabled(): boolean {
  return !!readEnv("RESEND_API_KEY") && !!readEnv("RECEBI_EMAIL_FROM");
}

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  fromName,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Nome exibido como remetente (ex.: o nome do freelancer). */
  fromName?: string;
}): Promise<boolean> {
  const apiKey = readEnv("RESEND_API_KEY");
  const from = readEnv("RECEBI_EMAIL_FROM");
  if (!apiKey || !from) return false;
  // RECEBI_EMAIL_FROM pode ser "Recebi <ola@dominio.com>" ou só o endereço.
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const sender = fromName ? `${fromName.replace(/[<>"]/g, "")} via Recebi <${address}>` : from;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sender, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** Layout padrão dos e-mails: cabeçalho com a marca, conteúdo e um botão. */
export function emailLayout({
  preheader,
  title,
  paragraphs,
  highlight,
  cta,
  footer,
}: {
  preheader: string;
  title: string;
  paragraphs: string[];
  highlight?: { label: string; value: string };
  cta?: { label: string; url: string };
  footer?: string;
}): string {
  const p = paragraphs.map((text) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#39445a">${text}</p>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f6f5f0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f0;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:30px;height:30px;background:#c9ff3c;border-radius:9px;text-align:center;font-weight:900;color:#101c34;font-size:17px">&#10003;</td>
<td style="padding-left:10px;font-size:19px;font-weight:800;color:#101c34">Recebi<span style="color:#9bd100">.</span></td></tr></table></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e2dfd6;border-radius:18px;padding:32px 28px">
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#101c34">${escapeHtml(title)}</h1>
${p}
${highlight ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;background:#101c34;border-radius:14px"><tr><td style="padding:16px 20px;color:rgba(255,255,255,.7);font-size:13px">${escapeHtml(highlight.label)}<div style="margin-top:4px;color:#c9ff3c;font-size:26px;font-weight:800">${escapeHtml(highlight.value)}</div></td></tr></table>` : ""}
${cta ? `<a href="${cta.url}" style="display:inline-block;background:#c9ff3c;color:#101c34;font-weight:800;font-size:15px;text-decoration:none;padding:13px 22px;border-radius:12px">${escapeHtml(cta.label)}</a>` : ""}
</td></tr>
<tr><td style="padding:18px 8px;font-size:12px;line-height:1.5;color:#7a8497;text-align:center">${footer ?? "Enviado pelo Recebi, o controle financeiro de freelancers."}</td></tr>
</table></td></tr></table></body></html>`;
}
