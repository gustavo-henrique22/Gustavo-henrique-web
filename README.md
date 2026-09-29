# Recebi — controle financeiro para freelancers

Este repositório tem duas partes:

- `/` — o portfólio de Gustavo Henrique (`app/page.tsx`)
- `/recebi` — o **Recebi**, um SaaS de controle financeiro para freelancers e MEIs

## O que o Recebi faz

- **Contas:** cadastro, login com e-mail ou Google, redefinição de senha e bloqueio após tentativas erradas
- **Demonstração:** botão "Ver demonstração" cria uma conta com dados fictícios (apagada em 24 horas)
- **Painel do mês:** recebido, gasto, lucro, imposto estimado, sobra livre, meta, comparação com o mês anterior e próximos vencimentos
- **Lançamentos** de receitas e despesas (com repetição mensal e comprovante anexado), **clientes** e **projetos**
- **Orçamentos:** link público onde o cliente aprova (com aceite eletrônico: nome, data, hora e IP) ou recusa; ao aprovar, a cobrança com Pix é criada sozinha
- **Cobranças:** link público com QR Code e Pix copia e cola; ao marcar como paga, a receita entra nos lançamentos
- **Cobrança rápida:** link de Pix em segundos, sem precisar montar itens
- **Cobranças recorrentes** (Pro): geradas todo mês e enviadas por e-mail automaticamente
- **Linha do tempo e avisos:** histórico de cada documento, "cliente abriu o link" e sininho de notificações
- **Controle de horas:** cronômetro por projeto e horas que viram cobrança com um clique
- **Previsão de caixa** dos próximos meses no painel
- **Importar extrato** (Pro): arquivos OFX/CSV de qualquer banco, com categorias automáticas, regras próprias, reconhecimento de clientes e baixa automática de cobranças
- **Página pública** em `/recebi/p/<endereço>`: serviços, preços e formulário de pedido de orçamento
- **Assistente com IA** (Claude): perguntas sobre as finanças em português e "Montar com IA" nos orçamentos
- **Resumo do mês** por e-mail e no sininho
- **Recibos:** página pronta para imprimir, com valor por extenso
- **Relatórios** anuais, limite do MEI e exportação para Excel (CSV)
- **Calculadora de preço** no painel e pública em `/recebi/calculadora`
- **Planos** Grátis e Pro (mensal ou anual), com venda automática pelo Mercado Pago
- **E-mails automáticos:** boas-vindas, envio de orçamentos e cobranças, recibo, lembretes de vencimento e avisos
- **App no celular** (PWA), tema claro/escuro e busca rápida com `Ctrl K`
- **Administração** em `/recebi/painel/admin`: usuários, planos, pagamentos e status das integrações

## Onde ficam as coisas

| Pasta | Conteúdo |
| --- | --- |
| `app/recebi/` | Páginas (landing, login, painel, páginas públicas `c/`, `o/` e `p/`, rotas `api/`) |
| `components/recebi/` | Componentes de interface do Recebi |
| `lib/recebi/` | Regras de negócio, consultas e server actions (`lib/recebi/actions/`) |
| `lib/recebi/config.ts` | Nome, preços do Pro, limites do plano Grátis e WhatsApp de suporte |
| `db/schema.ts` e `drizzle/` | Tabelas do banco D1 e as migrações geradas |
| `public/recebi/` | Ícones, manifesto do app, service worker e imagem de compartilhamento |

## Configuração (variáveis de ambiente)

Tudo funciona sem nenhuma variável. Cada integração abaixo liga sozinha quando as variáveis existem,
e o painel de administração mostra quais estão ativas.

| Variável | Para quê |
| --- | --- |
| `RECEBI_ADMIN_EMAILS` | E-mails de administradores, separados por vírgula. Sem ela, a **primeira conta criada** vira administradora. |
| `RECEBI_SITE_URL` | Endereço público do site (ex.: `https://meusite.com`), usado nos links dos e-mails. |
| `RESEND_API_KEY` e `RECEBI_EMAIL_FROM` | Envio de e-mails pelo [Resend](https://resend.com). `RECEBI_EMAIL_FROM` no formato `Recebi <ola@seudominio.com>`. |
| `MERCADOPAGO_ACCESS_TOKEN` | Venda automática do Pro (Pix, cartão e boleto) pelo Checkout Pro do Mercado Pago. |
| `MERCADOPAGO_WEBHOOK_SECRET` | (Opcional) Valida a assinatura das notificações do Mercado Pago. |
| `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` | Login com Google. No Google Cloud, cadastre o retorno `https://SEU-SITE/recebi/api/google/callback`. |
| `RECEBI_CRON_SECRET` | Libera a rota diária de tarefas automáticas (veja abaixo). |
| `ANTHROPIC_API_KEY` | Assistente e orçamentos com IA (Claude). Crie a chave em [console.anthropic.com](https://console.anthropic.com). |
| `ANTHROPIC_BASE_URL` | (Opcional) Endereço alternativo da API, por exemplo o AI Gateway da Cloudflare. |

**Mercado Pago:** o endereço de notificação (`/recebi/api/mercadopago`) é enviado automaticamente em cada
pagamento. O Pro também é liberado quando a pessoa volta do checkout, conferindo o pagamento na API.

**Tarefas diárias:** chame uma vez por dia (por exemplo, com o [cron-job.org](https://cron-job.org))
`https://SEU-SITE/recebi/api/lembretes?chave=VALOR_DE_RECEBI_CRON_SECRET`. Ela gera as cobranças recorrentes,
envia os lembretes (3 dias antes, no dia e 3 dias depois do vencimento, para clientes de usuários Pro) e,
nos primeiros dias do mês, o resumo do mês anterior. As recorrências também são geradas quando a pessoa abre o painel.

**Assistente com IA:** usa o modelo `claude-opus-5-5`. Cada pessoa tem um limite diário de perguntas
(5 no Grátis, 60 no Pro, 8 na demonstração) e o assistente só vê um resumo das finanças da própria conta.

**Arquivos (comprovantes e logos):** usam o binding R2 `FILES` declarado em `.openai/hosting.json`.

## Rodando localmente

```bash
npm run install:ci        # instala as dependências
npm run db:migrate:local  # cria as tabelas no banco D1 local
npm run dev               # abre em http://localhost:5173/recebi
```

Para testar integrações localmente, crie um arquivo `.dev.vars` (ignorado pelo Git) com as variáveis.
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
