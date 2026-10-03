// Campos sensíveis guardados criptografados (CPF/CNPJ, chave Pix, telefones, observações e mensagens).
// Use seal* ao gravar e open* ao ler. Valores antigos em texto continuam funcionando.
import type { Client, QuoteRequest, User } from "@/db/schema";
import { decryptField, encryptField } from "./encryption";

type UserSensitive = Pick<User, "id" | "document" | "pixKey" | "phone">;
type ClientSensitive = Pick<Client, "id" | "document" | "phone" | "notes">;
type RequestSensitive = Pick<QuoteRequest, "id" | "phone" | "message">;

export async function openUser<T extends UserSensitive>(user: T): Promise<T> {
  return {
    ...user,
    document: await decryptField(user.document, `users.document:${user.id}`),
    pixKey: await decryptField(user.pixKey, `users.pixKey:${user.id}`),
    phone: await decryptField(user.phone, `users.phone:${user.id}`),
  };
}

export async function sealUser(id: string, values: Partial<Pick<User, "document" | "pixKey" | "phone">>) {
  const out: Partial<Pick<User, "document" | "pixKey" | "phone">> = {};
  if (values.document !== undefined) out.document = await encryptField(values.document, `users.document:${id}`);
  if (values.pixKey !== undefined) out.pixKey = await encryptField(values.pixKey, `users.pixKey:${id}`);
  if (values.phone !== undefined) out.phone = await encryptField(values.phone, `users.phone:${id}`);
  return out;
}

export async function openClient<T extends ClientSensitive>(client: T): Promise<T> {
  return {
    ...client,
    document: await decryptField(client.document, `clients.document:${client.id}`),
    phone: await decryptField(client.phone, `clients.phone:${client.id}`),
    notes: await decryptField(client.notes, `clients.notes:${client.id}`),
  };
}

export async function openClients<T extends ClientSensitive>(clients: T[]): Promise<T[]> {
  return Promise.all(clients.map(openClient));
}

export async function sealClient(id: string, values: Partial<Pick<Client, "document" | "phone" | "notes">>) {
  const out: Partial<Pick<Client, "document" | "phone" | "notes">> = {};
  if (values.document !== undefined) out.document = await encryptField(values.document, `clients.document:${id}`);
  if (values.phone !== undefined) out.phone = await encryptField(values.phone, `clients.phone:${id}`);
  if (values.notes !== undefined) out.notes = await encryptField(values.notes, `clients.notes:${id}`);
  return out;
}

export async function openRequest<T extends RequestSensitive>(request: T): Promise<T> {
  return {
    ...request,
    phone: await decryptField(request.phone, `quoteRequests.phone:${request.id}`),
    message: await decryptField(request.message, `quoteRequests.message:${request.id}`),
  };
}

export async function sealRequest(id: string, values: Partial<Pick<QuoteRequest, "phone" | "message">>) {
  const out: Partial<Pick<QuoteRequest, "phone" | "message">> = {};
  if (values.phone !== undefined) out.phone = await encryptField(values.phone, `quoteRequests.phone:${id}`);
  if (values.message !== undefined) out.message = await encryptField(values.message, `quoteRequests.message:${id}`);
  return out;
}
