// Limpeza de textos de erro antes de guardar. Código puro (testável).

/** Remove dados que podem identificar alguém (e-mail, CPF/telefone, tokens de link). */
export function scrubErrorText(value: string, max = 500): string {
  return value
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[token]")
    .replace(/\d[\d.\-/ ]{7,}\d/g, "[número]")
    .slice(0, max);
}
