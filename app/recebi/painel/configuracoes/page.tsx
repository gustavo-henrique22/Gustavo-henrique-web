import type { Metadata } from "next";
import { Input } from "@/components/ui/input";
import { ActionForm } from "@/components/recebi/action-form";
import { FormField, MoneyInput } from "@/components/recebi/fields";
import { PageHeader } from "@/components/recebi/page-header";
import { changePassword, deleteAccount, updateFinanceSettings, updatePaymentSettings, updateProfile } from "@/lib/recebi/actions/account";
import { requireUser } from "@/lib/recebi/auth";
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

export default async function SettingsPage() {
  const user = await requireUser();
  const normalizedKey = normalizePixKey(user.pixKey);

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

        <Section title="Senha" description="Ao trocar a senha, os outros aparelhos conectados são desconectados.">
          <ActionForm action={changePassword} submitLabel="Trocar senha" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="current" label="Senha atual">
                <Input id="current" name="current" type="password" autoComplete="current-password" required />
              </FormField>
              <FormField id="next" label="Nova senha">
                <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
              </FormField>
            </div>
          </ActionForm>
        </Section>

        <Section
          title="Excluir conta"
          description="Apaga sua conta e todos os seus dados para sempre. Exporte seus relatórios antes."
          danger
        >
          <ActionForm action={deleteAccount} submitLabel="Excluir minha conta" submitVariant="destructive">
            <FormField id="delete-password" label="Confirme sua senha">
              <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
            </FormField>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
