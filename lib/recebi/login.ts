// Conclusão do login: sessão, aparelho conhecido/novo e registro de segurança.
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { knownDevices, users, type User } from "@/db/schema";
import { lockLink } from "./account-lock";
import { notify } from "./activity";
import { createSession } from "./auth";
import { APP_PATH } from "./config";
import { escapeHtml } from "./email";
import { sendSecurityAlertEmail } from "./notifications";
import { describeDevice, logSecurityEvent, requestMeta } from "./security";

export type LoginMethod = "senha" | "google" | "cadastro" | "redefinicao" | "2fa" | "recuperacao" | "passkey";

const COUNTRY_NAMES = new Intl.DisplayNames(["pt-BR"], { type: "region" });
const countryName = (code: string) => {
  try {
    return COUNTRY_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
};

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
      await sendSecurityAlertEmail(user, {
        subject: "Novo acesso à sua conta do Recebi",
        title: "Novo acesso à sua conta",
        lines: [
          `Sua conta foi acessada de um aparelho novo: <strong>${escapeHtml(device)}</strong>${ip ? ` (IP ${escapeHtml(ip)})` : ""}.`,
          "Se foi você, está tudo certo.",
        ],
        lockUrl: await lockLink(user.id),
      });
    }
  }

  // Acesso de um país diferente do último login: aviso extra (contas que viajam recebem só um aviso por mudança).
  const { country } = await requestMeta();
  if (country) {
    const [row] = await db.select({ last: users.lastLoginCountry }).from(users).where(eq(users.id, user.id)).limit(1);
    if (row && row.last !== country) {
      await db.update(users).set({ lastLoginCountry: country }).where(eq(users.id, user.id));
      if (row.last && method !== "cadastro") {
        const place = countryName(country);
        await logSecurityEvent(user.id, "login-pais-novo", `${place} (antes: ${countryName(row.last)})`);
        await notify(user.id, {
          type: "seguranca",
          title: `Acesso à sua conta a partir de: ${place}`,
          body: "Se não foi você, saia dos outros aparelhos e troque sua senha agora.",
          href: `${APP_PATH}/configuracoes/seguranca#sessoes`,
        });
        await sendSecurityAlertEmail(user, {
          subject: `Acesso à sua conta do Recebi a partir de: ${place}`,
          title: "Acesso de outro país",
          lines: [
            `Sua conta foi acessada a partir de <strong>${escapeHtml(place)}</strong>. O acesso anterior foi de ${escapeHtml(countryName(row.last))}.`,
          ],
          lockUrl: await lockLink(user.id),
        });
      }
    }
  }

  const type =
    method === "cadastro"
      ? "conta-criada"
      : method === "google"
        ? "login-google"
        : method === "recuperacao"
          ? "2fa-codigo-recuperacao"
          : method === "passkey"
            ? "login-passkey"
            : "login";
  await logSecurityEvent(user.id, type, device);
}
