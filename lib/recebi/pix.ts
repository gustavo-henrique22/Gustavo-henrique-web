// Gera o "Pix copia e cola" (BR Code estático) seguindo o padrão EMV do Banco Central.
import { renderSVG } from "uqr";

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** Remove acentos e caracteres que o padrão não aceita. */
function sanitize(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,\-@/]/g, "")
    .trim()
    .slice(0, max);
}

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function isValidCPF(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

/** Normaliza a chave: telefone vira +55..., CPF/CNPJ só números, e-mail em minúsculas. */
export function normalizePixKey(raw: string): string {
  const key = raw.trim();
  if (!key) return "";
  if (key.includes("@")) return key.toLowerCase();
  // Chave aleatória (EVP) é um UUID.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return key.toLowerCase();
  const digits = key.replace(/\D/g, "");
  if (key.startsWith("+")) return `+${digits}`;
  if (/^\(\d{2}\)/.test(key)) return `+55${digits}`;
  if (digits.length === 14) return digits; // CNPJ
  if (digits.length === 11) {
    // CPF e celular com DDD têm 11 dígitos: o dígito verificador decide.
    if (isValidCPF(digits)) return digits;
    if (digits[2] === "9") return `+55${digits}`;
    return digits;
  }
  if (digits.length === 10) return `+55${digits}`;
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  return digits || key;
}

export type PixInput = {
  key: string;
  name: string;
  city: string;
  amountCents?: number;
  txid?: string;
  description?: string;
};

export function buildPixPayload({ key, name, city, amountCents, txid, description }: PixInput): string {
  const accountInfo =
    field("00", "br.gov.bcb.pix") + field("01", normalizePixKey(key)) + (description ? field("02", sanitize(description, 40)) : "");

  const reference = sanitize(txid ?? "", 25).replace(/[^A-Za-z0-9]/g, "") || "***";

  const payload =
    field("00", "01") +
    field("26", accountInfo) +
    field("52", "0000") +
    field("53", "986") +
    (amountCents && amountCents > 0 ? field("54", (amountCents / 100).toFixed(2)) : "") +
    field("58", "BR") +
    field("59", sanitize(name, 25) || "RECEBEDOR") +
    field("60", sanitize(city, 15) || "BRASIL") +
    field("62", field("05", reference)) +
    "6304";

  return payload + crc16(payload);
}

export function pixQrSvg(payload: string): string {
  return renderSVG(payload, { ecc: "M", border: 2, pixelSize: 8, whiteColor: "#ffffff", blackColor: "#101c34" });
}
