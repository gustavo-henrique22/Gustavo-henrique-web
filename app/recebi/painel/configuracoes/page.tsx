import { Sparkles, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/recebi/action-button";
import { ActionForm } from "@/components/recebi/action-form";
import { FormField, MoneyInput } from "@/components/recebi/fields";
import { PageHeader } from "@/components/recebi/page-header";
import { InstallAppButton } from "@/components/recebi/pwa";
import { ThemeSwitcher } from "@/components/recebi/theme";
import {
  changePassword,
  deleteAccount,
  removeLogo,
  updateFinanceSettings,
  updatePaymentSettings,
  updateProfile,
  updateReminders,
  uploadLogo,
} from "@/lib/recebi/actions/account";
import { GOOGLE_ONLY_PASSWORD, hasPro, requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { emailEnabled } from "@/lib/recebi/email";
import { filesEnabled, logoUrlFor } from "@/lib/recebi/files";
import { normalizePixKey } from "@/lib/recebi/pix";

export const metadata: Metadata = { title: "Configurações" };

function Section({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`grid gap-6 rounded-2xl border bg-card p-5 shadow-xs sm:p-6 lg:grid-cols-[280px_1fr] ${danger ? "border-destructive/30" : ""}`}
    >
      <div>
        <h2 className={`font-bold ${danger ? "text-destructive" : ""}`}>{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="max-w-xl">{children}</div>
    </section>
  );
}

function ProNotice({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">{text}</p>
      <Link
        href={`${APP_PATH}/plano`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#c9ff3c] px-3 py-1.5 text-xs font-bold text-[#101c34]"
      >
        <Sparkles className="size-3.5" /> Conhecer o Pro
      </Link>
    </div>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const normalizedKey = normalizePixKey(user.pixKey);
  const googleOnly = user.passwordHash === GOOGLE_ONLY_PASSWORD;
  const logoUrl = logoUrlFor(user);

  return (
    <>
      <PageHeader title="Configurações" description="Seus dados, Pix, metas e segurança." />
      <div className="grid gap-4">
        <Section title="Perfil" description="Aparece nas cobranças que você envia.">
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
            </div>
          </ActionForm>
        </Section>

        <Section title="Recebimento via Pix" description="Com a chave cadastrada, toda cobrança ganha QR Code e Pix copia e cola.">
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
            </div>
          </ActionForm>
        </Section>

        <Section
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
            </div>
            <p className="text-xs text-muted-foreground">
              Se você é MEI e paga o DAS fixo, coloque 0% e lance o DAS como despesa na categoria &quot;Impostos (DAS, INSS)&quot;.
            </p>
          </ActionForm>
        </Section>

        <Section title="Sua marca" description="Sua logo no topo das cobranças, orçamentos e recibos. Deixa tudo com cara de empresa.">
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
                <FormField id="logo" label="Arquivo da logo" hint="PNG, JPG, WEBP ou SVG de até 1 MB. Fundo transparente fica melhor.">
                  <Input
                    id="logo"
                    name="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    required
                    className="cursor-pointer"
                  />
                </FormField>
              </ActionForm>
            </div>
          )}
        </Section>

        <Section
          title="Lembretes automáticos"
          description="O Recebi avisa seus clientes por e-mail 3 dias antes, no dia e 3 dias depois do vencimento das cobranças."
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
        </Section>

        <Section title="Aparência e app" description="Escolha o tema e instale o Recebi como aplicativo no celular ou no computador.">
          <div className="flex flex-wrap items-center gap-3">
            <ThemeSwitcher />
            <InstallAppButton />
          </div>
        </Section>

        <Section
          title={googleOnly ? "Criar senha" : "Senha"}
          description={
            googleOnly
              ? "Você entra com o Google. Se quiser, crie uma senha para entrar também com e-mail."
              : "Ao trocar a senha, os outros aparelhos conectados são desconectados."
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
              <FormField id="next" label="Nova senha">
                <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
              </FormField>
            </div>
          </ActionForm>
        </Section>

        <Section
          title="Excluir conta"
          description="Apaga sua conta, seus arquivos e todos os seus dados para sempre. Exporte seus relatórios antes."
          danger
        >
          <ActionForm action={deleteAccount} submitLabel="Excluir minha conta" submitVariant="destructive">
            {googleOnly ? (
              <FormField id="delete-confirm" label="Digite EXCLUIR para confirmar">
                <Input id="delete-confirm" name="confirm" autoComplete="off" required />
              </FormField>
            ) : (
              <FormField id="delete-password" label="Confirme sua senha">
                <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
              </FormField>
            )}
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
