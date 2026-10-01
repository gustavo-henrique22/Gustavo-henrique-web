// Núcleo da criptografia de campos (AES-256-GCM, Web Crypto). Sem acesso a variáveis de ambiente,
// para poder ser testado; use lib/recebi/encryption.ts no app.
//
// Formato guardado: enc:v1:<id da chave>:<iv>:<dados> (base64url). O "contexto" (ex.: "users.document:<id>")
// entra como dado autenticado: um valor copiado para outra linha ou coluna não abre.
// Sem RECEBI_ENCRYPTION_KEY, os valores ficam como texto (o painel de administração avisa).
// Para trocar a chave, mova a atual para RECEBI_ENCRYPTION_KEY_OLD e cadastre uma nova.

const PREFIX = "enc:v1:";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

type LoadedKey = { id: string; key: CryptoKey };
const cache = new Map<string, Promise<LoadedKey>>();

/** Deriva a chave AES de qualquer segredo longo (HKDF-SHA256) e calcula um identificador curto. */
function loadKey(secret: string): Promise<LoadedKey> {
  let pending = cache.get(secret);
  if (!pending) {
    pending = (async () => {
      const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
      const key = await crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt: encoder.encode("recebi-encryption-v1"), info: encoder.encode("fields") },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`recebi-key-id:${secret}`)));
      return { id: toBase64Url(digest).slice(0, 8), key };
    })();
    cache.set(secret, pending);
  }
  return pending;
}

const usable = (secret: string | undefined): secret is string => !!secret && secret.length >= 32;

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX);
}

/** Criptografa um valor. Vazio continua vazio; sem chave configurada, guarda como está. */
export async function encryptWith(secret: string | undefined, value: string, context: string): Promise<string> {
  if (!value || !usable(secret) || isEncrypted(value)) return value;
  const { id, key } = await loadKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource, additionalData: encoder.encode(context) },
      key,
      encoder.encode(value),
    ),
  );
  return `${PREFIX}${id}:${toBase64Url(iv)}:${toBase64Url(data)}`;
}

/** Abre um valor criptografado. Texto comum (de antes da chave existir) volta como está. */
export async function decryptWith(secrets: (string | undefined)[], value: string | null | undefined, context: string): Promise<string> {
  if (!value) return "";
  if (!isEncrypted(value)) return value;
  const [keyId, ivText, dataText] = value.slice(PREFIX.length).split(":");
  for (const secret of secrets.filter(usable)) {
    const { id, key } = await loadKey(secret);
    if (id !== keyId) continue;
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64Url(ivText) as BufferSource, additionalData: encoder.encode(context) },
        key,
        fromBase64Url(dataText) as BufferSource,
      );
      return decoder.decode(plain);
    } catch {
      return "";
    }
  }
  // Chave errada ou ausente: nunca devolvemos o texto cifrado como se fosse o valor.
  return "";
}

/** Começo dos valores criptografados com esta chave ("enc:v1:<id>:"), ou "" se a chave não serve. */
export async function currentPrefixWith(secret: string | undefined): Promise<string> {
  if (!usable(secret)) return "";
  return `${PREFIX}${(await loadKey(secret)).id}:`;
}

/** Precisa ser recriptografado com a chave atual (texto comum ou chave antiga)? */
export async function needsReencryptionWith(secret: string | undefined, value: string | null | undefined): Promise<boolean> {
  if (!value || !usable(secret)) return false;
  if (!isEncrypted(value)) return true;
  const { id } = await loadKey(secret);
  return !value.startsWith(`${PREFIX}${id}:`);
}
