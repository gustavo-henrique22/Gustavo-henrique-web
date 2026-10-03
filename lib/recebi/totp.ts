// Códigos de 6 dígitos dos apps autenticadores (TOTP, RFC 6238) e códigos de recuperação. Código puro (testável).

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Código base32 inválido.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(output);
}

/** Segredo novo de 160 bits, no formato que os apps autenticadores aceitam. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

async function hotp(key: Uint8Array, counter: number, digits: number): Promise<string> {
  const message = new ArrayBuffer(8);
  const view = new DataView(message);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const cryptoKey = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, message));
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totpCounter(nowMs: number): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

/** Código válido para um contador (janela de 30 segundos). Aceita o segredo em base32 ou em bytes. */
export function totpCode(secret: string | Uint8Array, counter: number, digits = 6): Promise<string> {
  return hotp(typeof secret === "string" ? base32Decode(secret) : secret, counter, digits);
}

/**
 * Confere o código digitado aceitando a janela anterior e a seguinte (relógio do celular um pouco adiantado
 * ou atrasado). Devolve o contador que bateu (para impedir reuso) ou null.
 */
export async function verifyTotp(secret: string, input: string, nowMs = Date.now(), window = 1): Promise<number | null> {
  const code = input.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secret);
  const current = totpCounter(nowMs);
  for (let delta = -window; delta <= window; delta++) {
    const expected = await totpCode(key, current + delta);
    if (timingSafeEqual(expected, code)) return current + delta;
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Endereço lido pelo QR Code (Google Authenticator, Authy, 1Password, Microsoft Authenticator…). */
export function otpauthUri({ secret, account, issuer }: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Deixa o segredo mais fácil de digitar à mão: grupos de 4 letras. */
export function formatSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

/** Dez códigos de uso único, no formato "abcde-fghij" (sem letras que se confundem). */
export function generateRecoveryCodes(count = 10): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: count }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

export function normalizeRecoveryCode(input: string): string {
  const clean = input.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean.length === 10 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : "";
}
