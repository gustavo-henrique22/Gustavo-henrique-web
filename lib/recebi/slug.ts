// Endereço da página pública: /recebi/p/<slug>.

const RESERVED = new Set([
  "admin",
  "api",
  "painel",
  "recebi",
  "entrar",
  "cadastro",
  "suporte",
  "ajuda",
  "sobre",
  "planos",
  "plano",
  "termos",
  "demo",
  "app",
  "www",
]);

/** "Marina Costa Design" → "marina-costa-design". */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) && !slug.includes("--") && !RESERVED.has(slug);
}
