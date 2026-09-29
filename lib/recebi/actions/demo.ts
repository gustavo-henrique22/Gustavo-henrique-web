"use server";

import { and, eq, gte, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { loginAttempts, users } from "@/db/schema";
import { createSession, destroySession, getCurrentUser } from "../auth";
import { APP_PATH, BASE_PATH } from "../config";
import { createDemoAccount } from "../demo-seed";
import { sqliteTimestamp } from "../rate-limit";

const DEMOS_PER_HOUR = 6;

/** Cria uma conta de demonstração com dados fictícios e entra nela. */
export async function startDemo(): Promise<void> {
  const current = await getCurrentUser();
  if (current) redirect(APP_PATH);

  const db = getDb();
  // Apaga demonstrações com mais de 24 horas (os dados relacionados saem em cascata).
  await db.delete(users).where(and(eq(users.isDemo, true), lt(users.createdAt, sqliteTimestamp(Date.now() - 86_400_000))));

  // Limite simples por endereço de rede para evitar abuso.
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `demo:${ip}`;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, key), gte(loginAttempts.createdAt, sqliteTimestamp(Date.now() - 3_600_000))));
  if (count >= DEMOS_PER_HOUR) redirect(`${BASE_PATH}?demo=limite`);
  await db.insert(loginAttempts).values({ id: crypto.randomUUID(), email: key });

  const userId = await createDemoAccount();
  await createSession(userId);
  redirect(`${APP_PATH}?demo=1`);
}

/** Sai da demonstração (apagando os dados fictícios) e vai para o cadastro. */
export async function leaveDemo(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  if (user?.isDemo) await getDb().delete(users).where(eq(users.id, user.id));
  redirect(`${BASE_PATH}/cadastro`);
}
