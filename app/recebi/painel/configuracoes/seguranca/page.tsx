import type { Metadata } from "next";
import { Input } from "@/components/ui/input";
import { ActionForm } from "@/components/recebi/action-form";
import { FormField } from "@/components/recebi/fields";
import { SettingsSection } from "@/components/recebi/settings-section";
import { changePassword } from "@/lib/recebi/actions/account";
import { GOOGLE_ONLY_PASSWORD, requireUser } from "@/lib/recebi/auth";

export const metadata: Metadata = { title: "Segurança" };

export default async function SecuritySettingsPage() {
  const user = await requireUser();
  const googleOnly = user.passwordHash === GOOGLE_ONLY_PASSWORD;

  return (
    <>
      <SettingsSection
        id="senha"
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
            <FormField id="next" label="Nova senha" hint="Mínimo de 10 caracteres. Uma frase fácil de lembrar é ótima.">
              <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
            </FormField>
          </div>
        </ActionForm>
      </SettingsSection>
    </>
  );
}
