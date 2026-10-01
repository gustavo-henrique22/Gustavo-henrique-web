// Arquivos do Recebi (comprovantes e logos) no Cloudflare R2, binding FILES
// declarado em .openai/hosting.json. Sem o binding, os recursos de upload ficam ocultos.
import { env } from "cloudflare:workers";
import type { User } from "@/db/schema";
import { hasPro } from "./auth";
import { extensionFor, sniffFileType } from "./file-types";

type R2Object = { body: ReadableStream; httpMetadata?: { contentType?: string }; size: number };
type R2Bucket = {
  put(key: string, value: ArrayBuffer | ReadableStream, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options: {
    prefix: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
// SVG não é aceito: pode carregar scripts. Logos SVG antigas continuam servidas em modo isolado.
export const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function bucket(): R2Bucket | null {
  const value = (env as unknown as Record<string, unknown>).FILES;
  return value && typeof value === "object" ? (value as R2Bucket) : null;
}

export function filesEnabled(): boolean {
  return bucket() !== null;
}

/** Valida e guarda um arquivo enviado. Devolve a chave ou uma mensagem de erro. */
export async function storeUpload(prefix: string, file: File, allowed: string[]): Promise<{ key: string; type: string } | { error: string }> {
  const store = bucket();
  if (!store) return { error: "O armazenamento de arquivos não está disponível." };
  if (file.size === 0) return { error: "O arquivo está vazio." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "O arquivo passa de 5 MB. Envie uma versão menor." };
  // O tipo vem do conteúdo do arquivo, não do nome nem do navegador (um .exe renomeado para .jpg é recusado).
  const data = await file.arrayBuffer();
  const type = sniffFileType(new Uint8Array(data.slice(0, 16)));
  if (!type || !allowed.includes(type)) {
    return { error: `Formato não aceito. Use ${allowed.map((t) => extensionFor(t).toUpperCase()).join(", ")}.` };
  }
  const key = `${prefix}/${crypto.randomUUID()}.${extensionFor(type)}`;
  await store.put(key, data, { httpMetadata: { contentType: type } });
  return { key, type };
}

export async function readFile(key: string): Promise<R2Object | null> {
  return (await bucket()?.get(key)) ?? null;
}

export async function removeFile(key: string | null | undefined): Promise<void> {
  if (key) await bucket()?.delete(key);
}

/** Apaga todos os arquivos de uma pessoa (usado ao excluir a conta). */
export async function removeUserFiles(userId: string): Promise<void> {
  const store = bucket();
  if (!store) return;
  for (const prefix of [`anexos/${userId}/`, `logos/${userId}/`]) {
    let cursor: string | undefined;
    do {
      const page = await store.list({ prefix, cursor, limit: 500 });
      if (page.objects.length) await store.delete(page.objects.map((object) => object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
}

/** Endereço da logo do freelancer nas cobranças e orçamentos (só no plano Pro). */
export function logoUrlFor(owner: Pick<User, "id" | "logoKey" | "plan" | "planExpiresAt">): string | null {
  if (!owner.logoKey || !hasPro(owner)) return null;
  return `/recebi/logo/${owner.id}?v=${owner.logoKey.slice(-12, -4)}`;
}
