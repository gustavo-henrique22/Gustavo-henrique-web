import { ArrowRightLeft, LogOut, Trash2, Users } from "lucide-react";
import type { Metadata } from "next";
import { ActionButton } from "@/components/recebi/action-button";
import { PageHeader } from "@/components/recebi/page-header";
import { ProNotice } from "@/components/recebi/pro-notice";
import { SettingsSection } from "@/components/recebi/settings-section";
import { TeamInviteForm } from "@/components/recebi/team-invite-form";
import { leaveTeam, removeMember, switchWorkspace } from "@/lib/recebi/actions/team";
import { getAccount, hasPro, requireActor } from "@/lib/recebi/auth";
import { formatDate } from "@/lib/recebi/dates";
import { listTeam, listWorkspaces, MAX_MEMBERS, ROLE_LABELS } from "@/lib/recebi/team";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Equipe" };

export default async function TeamPage() {
  const actor = await requireActor();
  const account = await getAccount();
  const [team, workspaces] = await Promise.all([listTeam(actor.id), listWorkspaces(actor.id)]);
  const currentId = account?.id ?? actor.id;

  return (
    <>
      <PageHeader title="Equipe" description="Trabalhe junto com sócio, assistente ou contador, cada um com o próprio login." />
      <div className="grid gap-6">
        {workspaces.length ? (
          <SettingsSection title="Contas que você acessa" description="Escolha em qual conta trabalhar agora.">
            <ul className="grid gap-2">
              {[{ ownerId: "", name: `${actor.businessName || actor.name} (sua conta)`, role: null as null | keyof typeof ROLE_LABELS }, ...workspaces].map((w) => {
                const active = (w.ownerId || actor.id) === currentId;
                return (
                  <li key={w.ownerId || "self"} className={cn("flex flex-wrap items-center gap-3 rounded-xl border p-3", active && "border-income/40 bg-income/5")}>
                    <Users className="size-5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{w.name}</p>
                      {w.role ? <p className="text-xs text-muted-foreground">{ROLE_LABELS[w.role]}</p> : null}
                    </div>
                    {active ? (
                      <span className="rounded bg-income/15 px-2 py-0.5 text-xs font-semibold text-income">Em uso</span>
                    ) : (
                      <ActionButton action={switchWorkspace} fields={{ ownerId: w.ownerId }} variant="outline" size="sm">
                        <ArrowRightLeft /> Trabalhar aqui
                      </ActionButton>
                    )}
                    {w.ownerId ? (
                      <ActionButton action={leaveTeam} fields={{ ownerId: w.ownerId }} variant="ghost" size="sm" aria-label={`Sair da equipe de ${w.name}`}>
                        <LogOut /> Sair
                      </ActionButton>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </SettingsSection>
        ) : null}

        <SettingsSection
          title="Sua equipe"
          description={`Até ${MAX_MEMBERS} pessoas. Editor usa tudo do dia a dia; só leitura apenas vê. Senha, segurança, plano e configurações continuam só seus.`}
        >
          {actor.isDemo ? (
            <p className="text-sm text-muted-foreground">Disponível nas contas de verdade.</p>
          ) : !hasPro(actor) ? (
            <ProNotice text="Montar uma equipe faz parte do plano Pro." />
          ) : (
            <div className="grid gap-5">
              {team.length ? (
                <ul className="grid gap-2">
                  {team.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold break-all">{m.email}</p>
                        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                          {ROLE_LABELS[m.role]} · {m.acceptedAt ? `entrou em ${formatDate(m.acceptedAt.slice(0, 10))}` : "convite pendente"}
                        </p>
                      </div>
                      <ActionButton action={removeMember} fields={{ id: m.id }} variant="ghost" size="sm" aria-label={`Remover ${m.email}`}>
                        <Trash2 /> Remover
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              ) : null}
              {team.length < MAX_MEMBERS ? <TeamInviteForm /> : <p className="text-sm text-muted-foreground">Sua equipe está completa.</p>}
            </div>
          )}
        </SettingsSection>
      </div>
    </>
  );
}
