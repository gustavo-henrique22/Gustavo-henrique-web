// Valor em reais por extenso, como nos recibos: 1250,50 → "mil duzentos e cinquenta reais e cinquenta centavos".
const UNITS = [
  "",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

/** 0–999 por extenso. */
function upTo999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest) {
    if (rest < 20) parts.push(UNITS[rest]);
    else {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      parts.push(u ? `${TENS[t]} e ${UNITS[u]}` : TENS[t]);
    }
  }
  return parts.join(" e ");
}

const SCALES = [
  { singular: "", plural: "" },
  { singular: "mil", plural: "mil" },
  { singular: "milhão", plural: "milhões" },
  { singular: "bilhão", plural: "bilhões" },
];

/** Número inteiro por extenso (até 999 bilhões). */
export function integerToWords(value: number): string {
  if (value === 0) return "zero";
  const groups: number[] = [];
  let n = Math.floor(value);
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const words: { text: string; group: number }[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    let text: string;
    if (i === 1) text = g === 1 ? "mil" : `${upTo999(g)} mil`;
    else if (i >= 2) text = `${upTo999(g)} ${g === 1 ? SCALES[i].singular : SCALES[i].plural}`;
    else text = upTo999(g);
    words.push({ text, group: g });
  }
  // "e" antes do último grupo quando ele é menor que 100 ou uma centena redonda (mil e cinco, mil e duzentos).
  return words
    .map((w, index) => {
      if (index === 0) return w.text;
      const isLast = index === words.length - 1;
      const joinWithE = isLast && (w.group < 100 || w.group % 100 === 0);
      return `${joinWithE ? "e " : ""}${w.text}`;
    })
    .join(" ");
}

export function moneyToWords(cents: number): string {
  const reais = Math.floor(Math.abs(cents) / 100);
  const centavos = Math.abs(cents) % 100;
  const parts: string[] = [];
  if (reais > 0) {
    const words = integerToWords(reais);
    // "um milhão de reais", "dois bilhões de reais"
    const de = reais % 1_000_000 === 0 ? " de" : "";
    parts.push(`${words}${de} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) parts.push(`${integerToWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return parts.length ? parts.join(" e ") : "zero real";
}
