// Plano Equipe (Pro): o dono convida até MAX_MEMBERS pessoas para trabalhar na conta dele.
// Papéis: "editor" (usa tudo do dia a dia) e "leitura" (só vê). Configurações, segurança, plano e cobrança da
// assinatura continuam só do dono. Cada membro entra com a própria conta e escolhe em qual conta trabalhar.
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, teamMembers, users, type TeamMember } from "@/db/schema";
import { currentSessionId, hasPro } from "./auth";
import { BASE_PATH, APP_PATH } from "./config";
import { randomToken, sha256Hex } from "./crypto";
import { siteOrigin } from "./origin";

export const MAX_MEMBERS = 3;
export const ROLE_LABELS = { editor: "Editor", leitura: "Só leitura" } as const;
export type TeamRole = keyof typeof ROLE_LABELS;

export async function listTeam(ownerId: string): Promise<TeamMember[]> {
  return getDb().select().from(teamMembers).where(eq(teamMembers.ownerId, ownerId)).orderBy(asc(teamMembers.createdAt));
}

/** Contas de outras pessoas onde este usuário é membro (só as com Pro ativo). */
export async function listWorkspaces(memberId: string) {
  const rows = await getDb()
    .select({
      ownerId: users.id,
      name: users.name,
      businessName: users.businessName,
      plan: users.plan,
      planExpiresAt: users.planExpiresAt,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.ownerId))
    .where(and(eq(teamMembers.memberId, memberId), isNotNull(teamMembers.acceptedAt)));
  return rows.filter((row) => hasPro(row)).map((row) => ({ ownerId: row.ownerId, name: row.businessName || row.name, role: row.role }));
}

/** Cria (ou renova) o convite e devolve o link. */
export async function createInvite(ownerId: string, email: string, role: TeamRole): Promise<string> {
  const token = randomToken();
  const inviteHash = await sha256Hex(token);
  await getDb()
    .insert(teamMembers)
    .values({ id: crypto.randomUUID(), ownerId, email, role, inviteHash })
    .onConflictDoUpdate({ target: [teamMembers.ownerId, teamMembers.email], set: { role, inviteHash } });
  return `${await siteOrigin()}${APP_PATH}/equipe/convite/${token}`;
}

export async function findInvite(token: string) {
  if (!token || token.length > 200) return null;
  const [row] = await getDb()
    .select({ invite: teamMembers, ownerName: users.name, businessName: users.businessName })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.ownerId))
    .where(eq(teamMembers.inviteHash, await sha256Hex(token)))
    .limit(1);
  return row ?? null;
}

export async function acceptInvite(inviteId: string, memberId: string): Promise<void> {
  await getDb()
    .update(teamMembers)
    .set({ memberId, acceptedAt: new Date().toISOString(), inviteHash: null })
    .where(eq(teamMembers.id, inviteId));
}

/** Muda a conta em que esta sessão trabalha (null = a própria). */
export async function setWorkspace(workspaceId: string | null): Promise<void> {
  const id = await currentSessionId();
  if (id) await getDb().update(sessions).set({ workspaceId }).where(eq(sessions.id, id));
}

/** Tira o membro de todas as sessões que estavam na conta do dono. */
export async function closeWorkspaceSessions(ownerId: string, memberId: string): Promise<void> {
  await getDb()
    .update(sessions)
    .set({ workspaceId: null })
    .where(and(eq(sessions.userId, memberId), eq(sessions.workspaceId, ownerId)));
}

export const inviteLoginPath = (token: string) => `${BASE_PATH}/entrar?next=${encodeURIComponent(`${APP_PATH}/equipe/convite/${token}`)}`;
