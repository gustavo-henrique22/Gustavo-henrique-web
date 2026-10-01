// Cabeçalhos de segurança do Recebi e bloqueio de requisições vindas de outros sites. Código puro (testável);
// aplicado a todas as páginas de /recebi pelo proxy.ts da raiz.

/** Rotas chamadas por outros servidores (pagamentos e tarefas diárias): não vêm do navegador. */
export const SERVER_TO_SERVER_PATHS = ["/recebi/api/pagamentos/", "/recebi/api/mercadopago", "/recebi/api/lembretes"];

/**
 * Política de conteúdo. Em produção, só rodam scripts com o "nonce" da resposta (e os que eles carregarem):
 * um script injetado por um invasor não tem o nonce e é bloqueado pelo navegador.
 * Em desenvolvimento, o Vite injeta scripts próprios; a política fica mais aberta.
 */
export function contentSecurityPolicy({ nonce, dev }: { nonce: string; dev: boolean }): string {
  const directives = [
    "default-src 'self'",
    dev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    dev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    // O pagamento do Pro pelo Mercado Pago sai de um formulário do Recebi.
    "form-action 'self' https://*.mercadopago.com.br https://*.mercadopago.com",
    "frame-ancestors 'self'",
  ];
  return directives.join("; ");
}

export function securityHeaders({ nonce, dev }: { nonce: string; dev: boolean }): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy({ nonce, dev }),
    // Só HTTPS por um ano (o navegador nem tenta HTTP).
    ...(dev ? {} : { "Strict-Transport-Security": "max-age=31536000" }),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    // Links públicos de cobrança têm um código no endereço: nunca é enviado inteiro para outros sites.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
}

/**
 * Proteção contra CSRF: um formulário ou script em outro site não pode enviar ações em nome de quem está logado.
 * Bloqueia métodos que alteram dados quando o navegador diz que a requisição veio de outra origem.
 * Requisições sem Origin e sem Sec-Fetch-Site (servidor para servidor) seguem; os cookies SameSite=Lax completam a proteção.
 */
export function isCrossSiteRequest({
  method,
  pathname,
  host,
  origin,
  secFetchSite,
}: {
  method: string;
  pathname: string;
  host: string;
  origin: string | null;
  secFetchSite: string | null;
}): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return false;
  if (SERVER_TO_SERVER_PATHS.some((path) => pathname.startsWith(path))) return false;
  if (origin) {
    if (origin === "null") return true;
    try {
      return new URL(origin).host.toLowerCase() !== host.toLowerCase();
    } catch {
      return true;
    }
  }
  return !!secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none";
}

/** Nonce novo para cada resposta (128 bits, base64). */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
