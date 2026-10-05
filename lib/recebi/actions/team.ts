"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { teamMembers } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { notify } from "../activity";
import { getAccount, hasPro, normalizeEmail, requireActor } from "../auth";
import { APP_PATH } from "../config";
import { emailEnabled } from "../email";
import { sendTeamInviteEmail } from "../notifications";
import { takeRateLimit } from "../rate-limit";
import { logSecurityEvent } from "../security";
import {
  acceptInvite,
  closeWorkspaceSessions,
  createInvite,
  findInvite,
  listTeam,
  listWorkspaces,
  MAX_MEMBERS,
  ROLE_LABELS,
  setWorkspace,
  type TeamRole,
} from "../team";

const TEAM_PATH = `${APP_PATH}/equipe`;

export async function inviteMember(_: ActionState, formData: FormData): Promise<ActionState & { link?: string }> {
  const owner = await requireActor();
  if (owner.isDemo) return fail("Crie sua conta para montar uma equipe.");
  if (!hasPro(owner)) return fail("A equipe faz parte do plano Pro.");
  if ((await getAccount())?.teamRole) return fail("Volte para a sua conta para convidar pessoas.");
  const email = normalizeEmail(text(formData, "email", 200));
  const roleInput = text(formData, "role", 20);
  const role: TeamRole = roleInput === "leitura" || roleInput === "contador" ? roleInput : "editor";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Informe um e-mail válido.");
  if (email === owner.email) return fail("Esse é o seu próprio e-mail.");
  const team = await listTeam(owner.id);
  if (!team.some((m) => m.email === email) && team.length >= MAX_MEMBERS) return fail(`A equipe tem no máximo ${MAX_MEMBERS} pessoas.`);
  if (!(await takeRateLimit(`convite-equipe:${owner.id}`, 20, 86_400_000))) return fail("Muitos convites hoje. Tente amanhã.");
  const link = await createInvite(owner.id, email, role);
  const sent = await sendTeamInviteEmail(email, owner.businessName || owner.name, ROLE_LABELS[role], link);
  await logSecurityEvent(owner.id, "equipe-convite", `${email} (${ROLE_LABELS[role]})`);
  revalidatePath(TEAM_PATH);
  return {
    ...success(sent ? `Convite enviado para ${email}.` : "Convite criado. Copie o link e envie para a pessoa."),
    link: sent && emailEnabled() ? undefined : link,
  };
}

export async function removeMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireActor();
  const [row] = await getDb()
    .delete(teamMembers)
    .where(and(eq(teamMembers.id, text(formData, "id", 64)), eq(teamMembers.ownerId, owner.id)))
    .returning();
  if (!row) return fail("Pessoa não encontrada.");
  if (row.memberId) await closeWorkspaceSessions(owner.id, row.memberId);
  await logSecurityEvent(owner.id, "equipe-removido", row.email);
  revalidatePath(TEAM_PATH);
  return success(`${row.email} não tem mais acesso à sua conta.`);
}

export async function acceptTeamInvite(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor();
  const found = await findInvite(text(formData, "token", 200));
  if (!found) return fail("Este convite não vale mais. Peça um novo.");
  if (found.invite.email !== actor.email) return fail(`Este convite é para ${found.invite.email}. Entre com esse e-mail para aceitar.`);
  if (found.invite.ownerId === actor.id) return fail("Esse convite é da sua própria conta.");
  await acceptInvite(found.invite.id, actor.id);
  await setWorkspace(found.invite.ownerId);
  await notify(found.invite.ownerId, {
    type: "equipe",
    title: `${actor.name} entrou na sua equipe`,
    body: `Acesso: ${ROLE_LABELS[found.invite.role]}.`,
    href: TEAM_PATH,
  });
  await logSecurityEvent(found.invite.ownerId, "equipe-entrou", actor.email);
  redirect(found.invite.role === "contador" ? `${APP_PATH}/relatorios` : APP_PATH);
}

/** Escolhe em qual conta trabalhar: "" = a própria. */
export async function switchWorkspace(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor();
  const ownerId = text(formData, "ownerId", 64);
  if (ownerId && !(await listWorkspaces(actor.id)).some((w) => w.ownerId === ownerId)) return fail("Você não tem acesso a essa conta.");
  await setWorkspace(ownerId || null);
  revalidatePath(APP_PATH, "layout");
  redirect(APP_PATH);
}

/** O membro sai da equipe de alguém. */
export async function leaveTeam(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor();
  const ownerId = text(formData, "ownerId", 64);
  await getDb()
    .delete(teamMembers)
    .where(and(eq(teamMembers.ownerId, ownerId), eq(teamMembers.memberId, actor.id)));
  await closeWorkspaceSessions(ownerId, actor.id);
  revalidatePath(APP_PATH, "layout");
  return success("Você saiu da equipe.");
}
