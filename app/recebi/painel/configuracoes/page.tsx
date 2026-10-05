import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/recebi/action-button";
import { ActionForm } from "@/components/recebi/action-form";
import { FormField, MoneyInput } from "@/components/recebi/fields";
import { ProNotice } from "@/components/recebi/pro-notice";
import { SettingsSection } from "@/components/recebi/settings-section";
import { InstallAppButton } from "@/components/recebi/pwa";
import { ThemeSwitcher } from "@/components/recebi/theme";
import {
  removeLogo,
  updateFinanceSettings,
  updateHourlyRate,
  updatePaymentSettings,
  updateProfile,
  updateMonthlySummary,
  updateReminders,
  uploadLogo,
} from "@/lib/recebi/actions/account";
import { GOOGLE_ONLY_PASSWORD, hasPro, requireActor } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { emailEnabled } from "@/lib/recebi/email";
import { filesEnabled, logoUrlFor } from "@/lib/recebi/files";
import { normalizePixKey } from "@/lib/recebi/pix";

export const metadata: Metadata = { title: "Configurações" };

/** Campo pedido só quando a pessoa troca o e-mail ou a chave Pix (proteção contra quem pegou a sessão). */
function SensitiveConfirmField({
  id,
  what,
  user,
}: {
  id: string;
  what: string;
  user: { totpEnabledAt: string | null; passwordHash: string };
}) {
  if (user.totpEnabledAt) {
    return (
      <FormField id={id} label="Código do app autenticador" hint={`Só é pedido para trocar ${what}.`}>
        <Input id={id} name="confirmCode" autoComplete="one-time-code" maxLength={20} placeholder="000000" />
      </FormField>
    );
  }
  if (user.passwordHash !== GOOGLE_ONLY_PASSWORD) {
    return (
      <FormField id={id} label="Senha atual" hint={`Só é pedida para trocar ${what}.`}>
        <Input id={id} name="confirmPassword" type="password" autoComplete="current-password" />
      </FormField>
    );
  }
  return null;
}

export default async function SettingsPage() {
  const user = await requireActor();
  const normalizedKey = normalizePixKey(user.pixKey);
  const logoUrl = logoUrlFor(user);

  return (
    <>
      <SettingsSection title="Perfil" description="Aparece nas cobranças que você envia.">
        <ActionForm action={updateProfile}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="name" label="Seu nome">
              <Input id="name" name="name" required defaultValue={user.name} />
            </FormField>
            <FormField id="businessName" label="Nome profissional">
              <Input id="businessName" name="businessName" defaultValue={user.businessName} placeholder="Ex.: Ana Souza Design" />
            </FormField>
            <FormField id="email" label="E-mail">
              <Input id="email" name="email" type="email" required defaultValue={user.email} />
            </FormField>
            <FormField id="phone" label="Telefone / WhatsApp">
              <Input id="phone" name="phone" type="tel" defaultValue={user.phone} />
            </FormField>
            <FormField id="document" label="CPF ou CNPJ" hint="Opcional. Aparece nas cobranças.">
              <Input id="document" name="document" defaultValue={user.document} />
            </FormField>
            {!user.isDemo ? <SensitiveConfirmField id="profile-confirm" what="o e-mail" user={user} /> : null}
          </div>
        </ActionForm>
      </SettingsSection>

      <SettingsSection
        id="pix"
        title="Recebimento via Pix"
        description="Com a chave cadastrada, toda cobrança ganha QR Code e Pix copia e cola."
      >
        <ActionForm action={updatePaymentSettings}>
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <FormField
              id="pixKey"
              label="Chave Pix"
              hint={
                user.pixKey && normalizedKey !== user.pixKey ? (
                  <>
                    Será usada como: <span className="font-mono">{normalizedKey}</span>
                  </>
                ) : (
                  "CPF, CNPJ, e-mail, celular ou chave aleatória."
                )
              }
            >
              <Input id="pixKey" name="pixKey" defaultValue={user.pixKey} placeholder="Ex.: voce@email.com" />
            </FormField>
            <FormField id="city" label="Sua cidade">
              <Input id="city" name="city" defaultValue={user.city} placeholder="Ex.: São Paulo" />
            </FormField>
            {user.pixKey && !user.isDemo ? <SensitiveConfirmField id="pix-confirm" what="a chave Pix" user={user} /> : null}
          </div>
        </ActionForm>
      </SettingsSection>

      <SettingsSection
        id="metas"
        title="Metas e impostos"
        description="Usados no painel para mostrar seu progresso, o imposto estimado e o quanto sobra livre."
      >
        <ActionForm action={updateFinanceSettings}>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="monthlyGoal" label="Meta de faturamento mensal">
              <MoneyInput id="monthlyGoal" name="monthlyGoal" defaultCents={user.monthlyGoalCents || undefined} />
            </FormField>
            <FormField id="taxRate" label="Imposto estimado (%)" hint="Ex.: 6 para Simples Nacional (anexo III).">
              <Input
                id="taxRate"
                name="taxRate"
                inputMode="decimal"
                defaultValue={(user.taxRateBp / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
              />
            </FormField>
            <FormField id="annualLimit" label="Limite anual de faturamento" hint="MEI: R$ 81.000. Deixe vazio para não acompanhar.">
              <MoneyInput id="annualLimit" name="annualLimit" defaultCents={user.annualLimitCents || undefined} />
            </FormField>
            <FormField id="das" label="Valor do DAS (MEI)" hint="Usado na previsão dos relatórios. Vazio: valor médio do MEI de serviços.">
              <MoneyInput id="das" name="das" defaultCents={user.dasCents || undefined} />
            </FormField>
          </div>
          <p className="text-xs text-muted-foreground">
            Se você é MEI e paga o DAS fixo, coloque 0% e lance o DAS como despesa na categoria &quot;Impostos (DAS, INSS)&quot;.
          </p>
        </ActionForm>
      </SettingsSection>

      <SettingsSection title="Valor da sua hora" description="Usado no controle de horas para transformar o tempo trabalhado em cobrança.">
        <div id="valor-hora" className="grid scroll-mt-24 gap-3">
          <ActionForm action={updateHourlyRate}>
            <FormField id="hourlyRate" label="Quanto você cobra por hora" hint="Cada projeto pode ter um valor diferente.">
              <MoneyInput id="hourlyRate" name="hourlyRate" defaultCents={user.hourlyRateCents || undefined} />
            </FormField>
          </ActionForm>
          <Link href={`${APP_PATH}/calculadora`} className="w-fit text-sm font-semibold underline underline-offset-2">
            Não sabe quanto cobrar? Use a calculadora de preço
          </Link>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Sua marca"
        description="Sua logo no topo das cobranças, orçamentos e recibos. Deixa tudo com cara de empresa."
      >
        {!hasPro(user) ? (
          <ProNotice text="Coloque sua logo nos documentos com o plano Pro." />
        ) : !filesEnabled() ? (
          <p className="text-sm text-muted-foreground">O armazenamento de arquivos não está ativo neste site.</p>
        ) : (
          <div className="grid gap-4">
            {logoUrl ? (
              <div className="flex items-center gap-4 rounded-xl border bg-muted/40 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo enviada pelo usuário */}
                <img src={logoUrl} alt="Sua logo" className="max-h-14 w-auto max-w-[180px] rounded bg-white object-contain p-1" />
                <ActionButton
                  action={removeLogo}
                  fields={{}}
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive hover:text-destructive"
                >
                  <Trash2 /> Remover
                </ActionButton>
              </div>
            ) : null}
            <ActionForm action={uploadLogo} submitLabel={logoUrl ? "Trocar logo" : "Enviar logo"} resetOnSuccess>
              <FormField id="logo" label="Arquivo da logo" hint="PNG, JPG ou WEBP de até 1 MB. Fundo transparente fica melhor.">
                <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required className="cursor-pointer" />
              </FormField>
            </ActionForm>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Avisos por e-mail"
        description="Lembretes de vencimento para seus clientes (3 dias antes, no dia e 3 dias depois) e um resumo do mês para você."
      >
        {!hasPro(user) ? (
          <ProNotice text="Lembretes automáticos de cobrança fazem parte do plano Pro." />
        ) : (
          <ActionForm action={updateReminders}>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="autoReminders"
                defaultChecked={user.autoReminders}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span>
                <span className="font-medium">Enviar lembretes para clientes com cobranças em aberto</span>
                <span className="block text-xs text-muted-foreground">
                  {emailEnabled()
                    ? "Só para clientes com e-mail cadastrado. As respostas vão direto para o seu e-mail."
                    : "O envio de e-mails ainda não foi ativado pelo administrador do site."}
                </span>
              </span>
            </label>
          </ActionForm>
        )}
        <div className="mt-4">
          <ActionForm action={updateMonthlySummary}>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="monthlySummary"
                defaultChecked={user.monthlySummary}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span>
                <span className="font-medium">Receber o resumo do mês</span>
                <span className="block text-xs text-muted-foreground">
                  Todo início de mês: quanto entrou, quanto saiu, seu melhor cliente e o que falta receber.
                </span>
              </span>
            </label>
          </ActionForm>
        </div>
      </SettingsSection>

      <SettingsSection title="Aparência e app" description="Escolha o tema e instale o Recebi como aplicativo no celular ou no computador.">
        <div className="flex flex-wrap items-center gap-3">
          <ThemeSwitcher />
          <InstallAppButton />
        </div>
      </SettingsSection>
    </>
  );
}
