// Registro de atividades sensíveis da conta (mostrado em Configurações → Segurança).
import { and, desc, eq, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { securityEvents } from "@/db/schema";

export const SECURITY_EVENT_LABELS: Record<string, string> = {
  login: "Entrou na conta",
  "login-google": "Entrou com o Google",
  "login-falhou": "Tentativa de login com senha errada",
  "login-novo-aparelho": "Entrou de um aparelho novo",
  "login-2fa-falhou": "Código de verificação errado",
  logout: "Saiu da conta",
  "senha-alterada": "Senha alterada",
  "senha-redefinida": "Senha redefinida pelo e-mail",
  "email-confirmado": "E-mail confirmado",
  "2fa-ativada": "Verificação em duas etapas ativada",
  "2fa-desativada": "Verificação em duas etapas desativada",
  "2fa-codigo-recuperacao": "Entrou com um código de recuperação",
  "2fa-novos-codigos": "Novos códigos de recuperação gerados",
  "sessao-encerrada": "Sessão encerrada em outro aparelho",
  "sessoes-encerradas": "Saiu de todos os outros aparelhos",
  "dados-exportados": "Dados da conta baixados",
  "plano-alterado": "Plano alterado",
  "link-desativado": "Link público desativado",
  "link-trocado": "Link público trocado",
  "nfse-configurada": "Nota fiscal configurada",
};

export async function requestMeta(): Promise<{ ip: string; userAgent: string }> {
  try {
    const h = await headers();
    const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    return { ip: ip.slice(0, 64), userAgent: (h.get("user-agent") ?? "").slice(0, 300) };
  } catch {
    return { ip: "", userAgent: "" };
  }
}

export async function logSecurityEvent(userId: string, type: string, detail = "") {
  const meta = await requestMeta();
  const db = getDb();
  await db.insert(securityEvents).values({ id: crypto.randomUUID(), userId, type, detail: detail.slice(0, 300), ...meta });
  // Guardamos só o último ano.
  const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().replace("T", " ").slice(0, 19);
  await db.delete(securityEvents).where(and(eq(securityEvents.userId, userId), lt(securityEvents.createdAt, yearAgo)));
}

export async function listSecurityEvents(userId: string, limit = 30) {
  return getDb()
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.userId, userId))
    .orderBy(desc(securityEvents.createdAt))
    .limit(limit);
}

/** "Chrome no Windows", "Safari no iPhone"… a partir do user-agent. */
export function describeDevice(userAgent: string): string {
  const ua = userAgent || "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Navegador";
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  return system ? `${browser} no ${system}` : browser;
}
