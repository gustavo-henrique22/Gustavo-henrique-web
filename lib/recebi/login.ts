// Conclusão do login: sessão, aparelho conhecido/novo e registro de segurança.
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { knownDevices, type User } from "@/db/schema";
import { notify } from "./activity";
import { createSession } from "./auth";
import { APP_PATH } from "./config";
import { sendNewDeviceEmail } from "./notifications";
import { describeDevice, logSecurityEvent } from "./security";

export type LoginMethod = "senha" | "google" | "cadastro" | "redefinicao" | "2fa" | "recuperacao";

export async function completeLogin(user: Pick<User, "id" | "name" | "email" | "isDemo">, method: LoginMethod): Promise<void> {
  const { deviceHash, userAgent, ip } = await createSession(user.id);
  if (user.isDemo) return;
  const db = getDb();
  const device = describeDevice(userAgent);

  const [known] = await db
    .select({ id: knownDevices.id })
    .from(knownDevices)
    .where(and(eq(knownDevices.userId, user.id), eq(knownDevices.deviceHash, deviceHash)))
    .limit(1);
  if (known) {
    await db.update(knownDevices).set({ lastSeenAt: new Date().toISOString(), userAgent }).where(eq(knownDevices.id, known.id));
  } else {
    const [{ total }] = await db.select({ total: count() }).from(knownDevices).where(eq(knownDevices.userId, user.id));
    await db
      .insert(knownDevices)
      .values({ id: crypto.randomUUID(), userId: user.id, deviceHash, userAgent, lastSeenAt: new Date().toISOString() })
      .onConflictDoNothing();
    // O primeiro aparelho (cadastro) não gera alerta; os seguintes, sim.
    if (total > 0 && method !== "cadastro") {
      await logSecurityEvent(user.id, "login-novo-aparelho", device);
      await notify(user.id, {
        type: "seguranca",
        title: `Novo acesso pelo ${device}`,
        body: "Se não foi você, troque sua senha e saia dos outros aparelhos agora.",
        href: `${APP_PATH}/configuracoes/seguranca#sessoes`,
      });
      await sendNewDeviceEmail(user, device, ip);
    }
  }

  const type =
    method === "cadastro"
      ? "conta-criada"
      : method === "google"
        ? "login-google"
        : method === "recuperacao"
          ? "2fa-codigo-recuperacao"
          : "login";
  await logSecurityEvent(user.id, type, device);
}
