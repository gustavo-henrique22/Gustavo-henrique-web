// Criptografia de campos sensíveis no banco (AES-256-GCM).
//
// Formato guardado: enc:v1:<id da chave>:<iv>:<dados>. O "contexto" (ex.: "users.document:<id>") entra como
// dado autenticado: um valor copiado para outra linha ou coluna não abre.
// Sem RECEBI_ENCRYPTION_KEY (mínimo 32 caracteres), os valores ficam como texto e o painel de administração avisa.
// Para trocar a chave, mova a atual para RECEBI_ENCRYPTION_KEY_OLD e cadastre uma nova.
import { readEnv } from "./email";
import { currentPrefixWith, decryptWith, encryptWith, isEncrypted, needsReencryptionWith } from "./encryption-core";

export { isEncrypted };

export function encryptionEnabled(): boolean {
  return (readEnv("RECEBI_ENCRYPTION_KEY")?.length ?? 0) >= 32;
}

export function encryptField(value: string, context: string): Promise<string> {
  return encryptWith(readEnv("RECEBI_ENCRYPTION_KEY"), value, context);
}

export function decryptField(value: string | null | undefined, context: string): Promise<string> {
  return decryptWith([readEnv("RECEBI_ENCRYPTION_KEY"), readEnv("RECEBI_ENCRYPTION_KEY_OLD")], value, context);
}

export function needsReencryption(value: string | null | undefined): Promise<boolean> {
  return needsReencryptionWith(readEnv("RECEBI_ENCRYPTION_KEY"), value);
}

/** Prefixo dos valores já criptografados com a chave atual ("" sem chave). */
export function currentEncryptionPrefix(): Promise<string> {
  return currentPrefixWith(readEnv("RECEBI_ENCRYPTION_KEY"));
}
