# Recebi — controle financeiro para freelancers

Este repositório tem duas partes:

- `/` — o portfólio de Gustavo Henrique (`app/page.tsx`)
- `/recebi` — o **Recebi**, um SaaS de controle financeiro para freelancers e MEIs

## O que o Recebi faz

- Cadastro, login, redefinição de senha e bloqueio após muitas tentativas erradas
- Painel do mês: recebido, gasto, lucro, imposto estimado, sobra livre, meta, a receber/a pagar e próximos vencimentos
- Lançamentos de receitas e despesas (com repetição mensal), clientes e projetos
- Cobranças com link público, QR Code e Pix copia e cola; ao marcar como paga, a receita entra sozinha nos lançamentos
- Relatórios anuais, acompanhamento do limite do MEI e exportação para Excel (CSV)
- Planos Grátis e Pro, e uma área de administração em `/recebi/painel/admin`

## Onde ficam as coisas

| Pasta | Conteúdo |
| --- | --- |
| `app/recebi/` | Páginas (landing, login, painel, cobrança pública) |
| `components/recebi/` | Componentes de interface do Recebi |
| `lib/recebi/` | Regras de negócio, consultas e server actions (`lib/recebi/actions/`) |
| `lib/recebi/config.ts` | Nome, preço do Pro, limites do plano Grátis e WhatsApp de suporte |
| `db/schema.ts` e `drizzle/` | Tabelas do banco D1 e a migração gerada |

## Administração e plano Pro

- A **primeira conta criada** vira administradora. Para escolher os administradores
  explicitamente, defina a variável `RECEBI_ADMIN_EMAILS` (e-mails separados por vírgula).
- O botão "Assinar pelo WhatsApp" abre uma conversa com o número em `SUPPORT_WHATSAPP`.
  Depois de receber o Pix, libere o Pro para o cliente no painel de administração (+1 mês ou +1 ano).
- Redefinição de senha por e-mail funciona quando `RESEND_API_KEY` e `RECEBI_EMAIL_FROM`
  estão configuradas ([Resend](https://resend.com)). Sem elas, o administrador gera o link
  de nova senha no painel e envia manualmente.

## Rodando localmente

```bash
npm run install:ci        # instala as dependências
npm run db:migrate:local  # cria as tabelas no banco D1 local
npm run dev               # abre em http://localhost:5173/recebi
```

Depois de alterar `db/schema.ts`, gere uma nova migração com `npm run db:generate`.
Em produção, a plataforma aplica as migrações de `drizzle/` no banco D1 declarado em `.openai/hosting.json`.

---

# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with
  `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper
  module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can
  prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned
  `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build and verify the rendered development-preview metadata
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
