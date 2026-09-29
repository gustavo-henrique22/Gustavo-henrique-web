import { formatMoney } from "./money";

export const PRICE_TYPE_LABELS = {
  fixo: "Preço fechado",
  "a-partir": "A partir de",
  hora: "Por hora",
  consulta: "Sob consulta",
} as const;

export function servicePriceLabel(priceType: string, priceCents: number): string {
  if (priceType === "consulta") return "Sob consulta";
  if (priceType === "hora") return `${formatMoney(priceCents)}/hora`;
  if (priceType === "a-partir") return `A partir de ${formatMoney(priceCents)}`;
  return formatMoney(priceCents);
}
