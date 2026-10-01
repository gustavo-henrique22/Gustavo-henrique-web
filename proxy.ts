// Roda antes de cada página do Recebi: bloqueia requisições forjadas por outros sites (CSRF)
// e aplica os cabeçalhos de segurança (CSP com nonce, HSTS, anti-clickjacking...).
import { NextResponse, type NextRequest } from "next/server";
import { createNonce, isCrossSiteRequest, securityHeaders } from "@/lib/recebi/security-headers";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const crossSite = isCrossSiteRequest({
    method: request.method,
    pathname: request.nextUrl.pathname,
    host,
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });
  if (crossSite) return new NextResponse("Requisição bloqueada por segurança.", { status: 403 });

  const nonce = createNonce();
  const headers = securityHeaders({ nonce, dev: process.env.NODE_ENV !== "production" });
  // O nonce também vai na requisição: o React usa para marcar os scripts da página.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", headers["Content-Security-Policy"]);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

export const config = { matcher: ["/recebi", "/recebi/:path*"] };
