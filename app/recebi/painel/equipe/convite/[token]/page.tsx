import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/recebi/action-form";
import { acceptTeamInvite } from "@/lib/recebi/actions/team";
import { getCurrentUser } from "@/lib/recebi/auth";
import { BASE_PATH } from "@/lib/recebi/config";
import { findInvite, inviteLoginPath, ROLE_LABELS } from "@/lib/recebi/team";

export const metadata: Metadata = { title: "Convite para a equipe", robots: { index: false, follow: false } };

export default async function TeamInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [found, user] = await Promise.all([findInvite(token), getCurrentUser()]);

  return (
    <div className="mx-auto grid max-w-md gap-5 py-6">
      <span className="grid size-12 place-items-center rounded-2xl bg-[#c9ff3c] text-[#101c34]">
        <Users className="size-6" />
      </span>
      {!found ? (
        <>
          <h1 className="text-2xl font-extrabold">Convite inválido</h1>
          <p className="text-sm text-muted-foreground">Este convite já foi usado ou foi cancelado. Peça um novo para quem convidou você.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold">Entrar na equipe de {found.businessName || found.ownerName}</h1>
          <p className="text-sm text-muted-foreground">
            Acesso: <strong className="text-foreground">{ROLE_LABELS[found.invite.role]}</strong>. Você continua com a sua própria conta e
            escolhe em qual trabalhar na página Equipe.
          </p>
          {!user ? (
            <p className="text-sm">
              <Link href={inviteLoginPath(token)} className="font-semibold underline underline-offset-2">
                Entre
              </Link>{" "}
              ou{" "}
              <Link href={`${BASE_PATH}/cadastro`} className="font-semibold underline underline-offset-2">
                crie sua conta grátis
              </Link>{" "}
              com o e-mail <strong>{found.invite.email}</strong> e abra este link de novo.
            </p>
          ) : (
            <ActionForm action={acceptTeamInvite} submitLabel="Aceitar o convite">
              <input type="hidden" name="token" value={token} />
              <p className="text-sm text-muted-foreground">Você está entrando como {user.email}.</p>
            </ActionForm>
          )}
        </>
      )}
    </div>
  );
}
