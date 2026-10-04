import { PageHeader } from "@/components/recebi/page-header";
import { SettingsTabs } from "@/components/recebi/settings-tabs";
import { getAccount } from "@/lib/recebi/auth";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  return (
    <>
      <PageHeader title="Configurações" description="Seus dados, Pix, segurança, nota fiscal e privacidade." />
      {account?.teamRole ? (
        <p className="mb-4 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Aqui ficam as configurações da <strong>sua</strong> conta. As da conta de {account.name} só o dono pode mudar.
        </p>
      ) : null}
      <SettingsTabs />
      <div className="grid gap-4">{children}</div>
    </>
  );
}
