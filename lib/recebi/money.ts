const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Formata centavos como moeda brasileira: 123456 → "R$ 1.234,56". */
export function formatMoney(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, " ");
}

export function formatMoneyCompact(cents: number): string {
  return brlCompact.format(cents / 100).replace(/ /g, " ");
}

/** Valor em reais para preencher um campo de formulário: 123456 → "1234,56". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Converte o que a pessoa digitou em centavos. Aceita "1.234,56", "1234,5",
 * "1234.56", "R$ 1.234" e "1,234.56". Retorna null quando não é um valor válido.
 */
export function parseMoney(input: string): number | null {
  let value = input
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
  if (!value) return null;
  const negative = value.startsWith("-");
  if (negative) value = value.slice(1);
  if (!/^[\d.,]+$/.test(value)) return null;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    // O separador que aparece por último é o decimal.
    normalized = lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (lastComma > -1) {
    normalized = value.split(",").length > 2 ? value.replace(/,/g, "") : value.replace(",", ".");
  } else if (lastDot > -1) {
    // "1.234" com três casas depois do ponto é milhar; "12.5" é decimal.
    const parts = value.split(".");
    const isThousands = parts.length > 2 || parts[parts.length - 1].length === 3;
    normalized = isThousands ? value.replace(/\./g, "") : value;
  } else {
    normalized = value;
  }

  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  const cents = Math.round(number * 100);
  return negative ? -cents : cents;
}

/** Porcentagem em pontos-base (600 = 6%) para texto: "6%" ou "15,5%". */
export function formatPercentBp(bp: number): string {
  return `${(bp / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
