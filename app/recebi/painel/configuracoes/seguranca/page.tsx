import { CircleAlert, CircleCheck, KeyRound, Laptop, LogOut, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/recebi/action-button";
import { ActionForm } from "@/components/recebi/action-form";
import { FormField } from "@/components/recebi/fields";
import { PasskeyRegisterForm } from "@/components/recebi/passkey-buttons";
import { SettingsSection } from "@/components/recebi/settings-section";
import { TwoFactorPanel } from "@/components/recebi/two-factor-panel";
import { changePassword } from "@/lib/recebi/actions/account";
import { removePasskey } from "@/lib/recebi/actions/passkeys";
import { resendVerificationEmail, revokeOtherSessions, revokeSession } from "@/lib/recebi/actions/security";
import { APP_PATH } from "@/lib/recebi/config";
import { listPasskeys } from "@/lib/recebi/passkeys";
import { confirmPath, hasRecentAuth } from "@/lib/recebi/reauth";
import { currentSessionId, GOOGLE_ONLY_PASSWORD, requireUser } from "@/lib/recebi/auth";
import { listSessions } from "@/lib/recebi/data";
import { formatDateTime, formatRelative } from "@/lib/recebi/dates";
import { emailEnabled } from "@/lib/recebi/email";
import { pixQrSvg } from "@/lib/recebi/pix";
import { describeDevice, listSecurityEvents, SECURITY_EVENT_LABELS } from "@/lib/recebi/security";
import { formatSecret, otpauthUri } from "@/lib/recebi/totp";
import { openTotpSecret, recoveryCodesLeft } from "@/lib/recebi/two-factor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Segurança" };

/** Mostra só o começo do IP (privacidade na tela). */
function maskIp(ip: string) {
  if (!ip) return "";
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}:…`;
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : ip;
}

const ALERT_EVENTS = new Set([
  "login-falhou",
  "login-novo-aparelho",
  "login-2fa-falhou",
  "2fa-desativada",
  "chave-pix-alterada",
  "email-alterado",
]);

export default async function SecuritySettingsPage({ searchParams }: { searchParams: Promise<{ admin?: string }> }) {
  const user = await requireUser();
  const adminNeeds2fa = (await searchParams).admin === "1" && user.isAdmin;
  const googleOnly = user.passwordHash === GOOGLE_ONLY_PASSWORD;
  const [sessionRows, current, events, keys, recent] = await Promise.all([
    listSessions(user.id),
    currentSessionId(),
    listSecurityEvents(user.id, 25),
    listPasskeys(user.id),
    hasRecentAuth(),
  ]);
  const pendingSecret = !user.totpEnabledAt && user.totpSecret ? await openTotpSecret(user) : "";
  const twoFactor = user.totpEnabledAt
    ? { status: "on" as const, enabledAt: user.totpEnabledAt, codesLeft: recoveryCodesLeft(user), needsPassword: !googleOnly }
    : pendingSecret
      ? {
          status: "setup" as const,
          qrSvg: pixQrSvg(otpauthUri({ secret: pendingSecret, account: user.email, issuer: "Recebi" })),
          secret: formatSecret(pendingSecret),
        }
      : { status: "off" as const };

  return (
    <>
      {adminNeeds2fa ? (
        <p className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          Para usar o painel de administração, ative a verificação em duas etapas ou crie uma chave de acesso abaixo.
        </p>
      ) : null}
      <SettingsSection id="email" title="E-mail da conta" description="Usado para entrar, recuperar a senha e receber avisos de segurança.">
        <div className="grid gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            {user.email}
            {user.emailVerifiedAt ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-income/15 px-2 py-0.5 text-xs font-semibold text-income">
                <CircleCheck className="size-3.5" /> Confirmado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                <CircleAlert className="size-3.5" /> Não confirmado
              </span>
            )}
          </p>
          {!user.emailVerifiedAt ? (
            emailEnabled() ? (
              <ActionButton action={resendVerificationEmail} fields={{}} variant="outline" className="w-fit">
                Enviar link de confirmação
              </ActionButton>
            ) : (
              <p className="text-sm text-muted-foreground">A confirmação fica disponível quando o envio de e-mails for ativado no site.</p>
            )
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        id="senha"
        title={googleOnly ? "Criar senha" : "Senha"}
        description={
          googleOnly
            ? "Você entra com o Google. Se quiser, crie uma senha para entrar também com e-mail."
            : "Ao trocar a senha, os outros aparelhos conectados são desconectados e você recebe um aviso por e-mail."
        }
      >
        {user.googleSub && !googleOnly ? (
          <p className="mb-4 text-sm text-muted-foreground">Sua conta também está conectada ao Google.</p>
        ) : null}
        <ActionForm action={changePassword} submitLabel={googleOnly ? "Criar senha" : "Trocar senha"} resetOnSuccess>
          <div className="grid gap-4 sm:grid-cols-2">
            {!googleOnly ? (
              <FormField id="current" label="Senha atual">
                <Input id="current" name="current" type="password" autoComplete="current-password" required />
              </FormField>
            ) : null}
            <FormField id="next" label="Nova senha" hint="Mínimo de 8 caracteres. Uma frase fácil de lembrar é ótima.">
              <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
            </FormField>
          </div>
        </ActionForm>
      </SettingsSection>

      <SettingsSection
        id="duas-etapas"
        title="Verificação em duas etapas"
        description="A proteção mais forte contra senha roubada. Recomendado para todas as contas."
      >
        {user.isDemo ? (
          <p className="text-sm text-muted-foreground">Disponível nas contas de verdade.</p>
        ) : (
          <TwoFactorPanel {...twoFactor} />
        )}
      </SettingsSection>

      <SettingsSection
        id="chaves"
        title="Chaves de acesso"
        description="Entre com a digital, o rosto ou o PIN do aparelho, sem senha. É o jeito mais seguro: não dá para ser roubada por sites falsos."
      >
        {user.isDemo ? (
          <p className="text-sm text-muted-foreground">Disponível nas contas de verdade.</p>
        ) : (
          <div className="grid gap-4">
            {keys.length ? (
              <ul className="grid gap-2">
                {keys.map((key) => (
                  <li key={key.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <KeyRound className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{key.name || "Chave de acesso"}</p>
                      <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                        Criada em {formatDateTime(key.createdAt)}
                        {key.lastUsedAt ? ` · usada ${formatRelative(key.lastUsedAt)}` : " · ainda não usada"}
                      </p>
                    </div>
                    {recent ? (
                      <ActionButton
                        action={removePasskey}
                        fields={{ id: key.id }}
                        variant="ghost"
                        size="sm"
                        aria-label={`Remover ${key.name}`}
                      >
                        <Trash2 /> Remover
                      </ActionButton>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {recent ? (
              <PasskeyRegisterForm />
            ) : (
              <Link
                href={confirmPath(`${APP_PATH}/configuracoes/seguranca#chaves`)}
                className="inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted"
              >
                <ShieldCheck className="size-4" /> Confirmar identidade para {keys.length ? "gerenciar" : "criar"} chaves
              </Link>
            )}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        id="sessoes"
        title="Aparelhos conectados"
        description="Onde sua conta está aberta agora. Não reconhece algum? Desconecte e troque sua senha."
      >
        <ul className="grid gap-2">
          {sessionRows.map((session) => {
            const isCurrent = session.id === current;
            const device = describeDevice(session.userAgent);
            const Icon = /iPhone|Android|iPad/.test(device) ? Smartphone : Laptop;
            return (
              <li
                key={session.id}
                className={cn("flex items-center gap-3 rounded-xl border p-3", isCurrent && "border-income/40 bg-income/5")}
              >
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {device}
                    {isCurrent ? <span className="rounded bg-income/15 px-1.5 py-0.5 text-xs text-income">Este aparelho</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {session.ip ? `IP ${maskIp(session.ip)} · ` : ""}último acesso {formatRelative(session.lastSeenAt ?? session.createdAt)}{" "}
                    · entrou em {formatDateTime(session.createdAt)}
                  </p>
                </div>
                {!isCurrent ? (
                  <ActionButton
                    action={revokeSession}
                    fields={{ id: session.id }}
                    variant="ghost"
                    size="sm"
                    aria-label={`Desconectar ${device}`}
                  >
                    <LogOut /> Desconectar
                  </ActionButton>
                ) : null}
              </li>
            );
          })}
        </ul>
        {sessionRows.length > 1 ? (
          <ActionButton action={revokeOtherSessions} fields={{}} variant="outline" className="mt-4">
            <LogOut /> Sair de todos os outros aparelhos
          </ActionButton>
        ) : null}
      </SettingsSection>

      <SettingsSection
        id="atividade"
        title="Atividade recente"
        description="Logins e mudanças importantes na sua conta, dos últimos 12 meses."
      >
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
        ) : (
          <ol className="grid gap-1">
            {events.map((event) => (
              <li key={event.id} className="flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    ALERT_EVENTS.has(event.type) ? "bg-warning" : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{SECURITY_EVENT_LABELS[event.type] ?? event.type}</span>
                  <span className="block truncate text-xs text-muted-foreground" suppressHydrationWarning>
                    {formatDateTime(event.createdAt)}
                    {event.detail ? ` · ${event.detail}` : ""}
                    {event.ip && !event.detail.includes("IP") ? ` · IP ${maskIp(event.ip)}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </SettingsSection>
    </>
  );
}
