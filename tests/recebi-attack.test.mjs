// Testes de ataque contra o site rodando (build de produção). No CI, o servidor sobe com `vite preview` antes.
// Rodar localmente: npm run build, `vite preview --port 4173` e depois
//   RECEBI_TEST_URL=http://127.0.0.1:4173 node --test tests/recebi-attack.test.mjs
import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";

const BASE = (process.env.RECEBI_TEST_URL ?? "http://127.0.0.1:4173").replace(/\/$/, "");
const SITE = `${BASE}/recebi`;
const ORIGIN = new URL(BASE).origin;

const get = (path, init = {}) => fetch(`${SITE}${path}`, { redirect: "manual", ...init });
const isRedirectToLogin = (response) =>
  [302, 303, 307, 308].includes(response.status) && (response.headers.get("location") ?? "").includes("/recebi/entrar");

test("security headers are present on every Recebi page", async () => {
  for (const path of ["", "/entrar", "/cadastro", "/termos"]) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    const csp = response.headers.get("content-security-policy") ?? "";
    assert.match(csp, /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/, `CSP com nonce em ${path}`);
    assert.doesNotMatch(csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "", /unsafe-inline|unsafe-eval/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("strict-transport-security") ?? "", /max-age=\d+/);
    assert.ok(response.headers.get("referrer-policy"));
    assert.ok(response.headers.get("permissions-policy"));
  }
});

test("every script on the page carries the response nonce (injected scripts would not run)", async () => {
  const response = await get("/entrar");
  const nonce = (response.headers.get("content-security-policy") ?? "").match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce);
  const html = await response.text();
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  assert.ok(scripts.length > 0);
  for (const tag of scripts) assert.ok(tag.includes(`nonce="${nonce}"`), `script sem nonce: ${tag.slice(0, 80)}`);
});

test("forged requests from other sites are blocked (CSRF)", async () => {
  for (const headers of [{ Origin: "https://golpe.example" }, { "Sec-Fetch-Site": "cross-site" }, { Origin: "null" }]) {
    const response = await get("/entrar", { method: "POST", headers: { ...headers, "Content-Type": "text/plain" }, body: "x" });
    assert.equal(response.status, 403, JSON.stringify(headers));
  }
});

test("private pages and APIs need a login", async () => {
  for (const path of ["/painel", "/painel/admin", "/painel/configuracoes/seguranca", "/painel/clientes", "/painel/confirmar-identidade"]) {
    assert.ok(isRedirectToLogin(await get(path)), path);
  }
  // Cookie de sessão inventado não vale.
  assert.ok(isRedirectToLogin(await get("/painel", { headers: { Cookie: "recebi_session=sessao-forjada-123" } })));
  assert.equal((await get("/api/meus-dados")).status, 401);
  assert.equal((await get("/painel/anexos/qualquer-id")).status, 401);
  assert.equal((await get("/painel/admin/backup/2026-01-01")).status, 404);
  const ai = await get("/api/assistente", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ messages: [{ role: "user", content: "oi" }] }),
  });
  assert.equal(ai.status, 401);
});

test("injection and path tricks in public links find nothing", async () => {
  for (const path of [
    "/c/' OR '1'='1",
    "/c/%27%20OR%201%3D1--",
    "/o/..%2F..%2Fetc%2Fpasswd",
    "/c/abc/recibo",
    "/p/%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    "/confirmar-email/token-falso",
    "/bloquear-conta/token-falso",
  ]) {
    const response = await get(path);
    assert.ok([200, 404].includes(response.status), `${path}: ${response.status}`);
    const html = await response.text();
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/, path);
    assert.doesNotMatch(html, /SQLITE_ERROR|D1_ERROR|stack trace/i, path);
  }
});

test("payment webhooks never accept unsigned notices", async () => {
  for (const path of ["/api/pagamentos/kiwify", "/api/pagamentos/kiwify?signature=falsa", "/api/pagamentos/shopify"]) {
    const response = await get(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Hmac-Sha256": "ZmFsc2E=" },
      body: JSON.stringify({ order_id: "1", order_status: "paid", webhook_event_type: "order_approved", Customer: { email: "a@b.c" } }),
    });
    assert.ok([401, 404].includes(response.status), `${path}: ${response.status}`);
  }
  const cron = await get("/api/lembretes?chave=errada");
  assert.ok([401, 404].includes(cron.status));
});

test("visitors arriving over HTTP are sent to HTTPS", async () => {
  // fetch não deixa trocar o Host; com node:http simulamos outro endereço (o servidor de teste só aceita IPs).
  const url = new URL(`${SITE}/entrar`);
  const { status, location } = await new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { Host: `127.0.0.2:${url.port}`, "cf-visitor": '{"scheme":"http"}' },
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode, location: res.headers.location ?? "" });
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(status, 308);
  assert.equal(location, "https://127.0.0.2/recebi/entrar");
});
