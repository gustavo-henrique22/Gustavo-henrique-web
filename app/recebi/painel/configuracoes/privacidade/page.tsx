import { Download, FileText, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionForm } from "@/components/recebi/action-form";
import { FormField } from "@/components/recebi/fields";
import { SettingsSection } from "@/components/recebi/settings-section";
import { deleteAccount } from "@/lib/recebi/actions/account";
import { GOOGLE_ONLY_PASSWORD, requireUser } from "@/lib/recebi/auth";
import { APP_PATH, BASE_PATH } from "@/lib/recebi/config";
import { confirmPath, hasRecentAuth } from "@/lib/recebi/reauth";

export const metadata: Metadata = { title: "Privacidade" };

export default async function PrivacySettingsPage() {
  const user = await requireUser();
  const googleOnly = user.passwordHash === GOOGLE_ONLY_PASSWORD;
  const confirmed = await hasRecentAuth();

  return (
    <>
      <SettingsSection
        id="meus-dados"
        title="Baixar meus dados"
        description="Um arquivo com tudo o que está na sua conta: perfil, clientes, lançamentos, cobranças, orçamentos e histórico."
      >
        <div className="grid gap-3">
          <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />O arquivo é gerado na hora, só para você, em formato aberto (JSON). Guarde em
            local seguro: ele tem dados pessoais.
          </p>
          {confirmed ? (
            <Button asChild className="w-fit">
              <a href={`${BASE_PATH}/api/meus-dados`} download>
                <Download /> Baixar meus dados
              </a>
            </Button>
          ) : (
            <Button asChild className="w-fit">
              <Link href={confirmPath(`${APP_PATH}/configuracoes/privacidade#meus-dados`)}>
                <ShieldCheck /> Confirmar identidade para baixar
              </Link>
            </Button>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Seus direitos (LGPD)" description="Você manda nos seus dados.">
        <ul className="grid gap-2 text-sm text-muted-foreground">
          <li>• Corrija qualquer informação direto no painel.</li>
          <li>• Leve seus dados para outro serviço com o arquivo acima.</li>
          <li>• Desligue o resumo do mês por e-mail em Configurações → Geral.</li>
          <li>• Exclua a conta e tudo o que está nela quando quiser.</li>
        </ul>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={`${BASE_PATH}/privacidade`} target="_blank">
            <FileText /> Ler a política de privacidade
          </Link>
        </Button>
      </SettingsSection>

      <SettingsSection
        id="excluir"
        title="Excluir conta"
        description="Apaga sua conta, seus arquivos e todos os seus dados para sempre. Baixe seus dados antes, se quiser guardar uma cópia."
        danger
      >
        {user.isDemo ? (
          <p className="text-sm text-muted-foreground">Contas de demonstração são apagadas sozinhas em 24 horas.</p>
        ) : (
          <ActionForm action={deleteAccount} submitLabel="Excluir minha conta para sempre" submitVariant="destructive">
            <FormField id="delete-confirm" label="Digite EXCLUIR para confirmar">
              <Input id="delete-confirm" name="confirm" autoComplete="off" required pattern="[Ee][Xx][Cc][Ll][Uu][Ii][Rr]" />
            </FormField>
            {!googleOnly ? (
              <FormField id="delete-password" label="Sua senha">
                <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
              </FormField>
            ) : null}
          </ActionForm>
        )}
      </SettingsSection>
    </>
  );
}
