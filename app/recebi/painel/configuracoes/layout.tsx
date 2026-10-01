import { PageHeader } from "@/components/recebi/page-header";
import { SettingsTabs } from "@/components/recebi/settings-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Configurações" description="Seus dados, Pix, segurança, nota fiscal e privacidade." />
      <SettingsTabs />
      <div className="grid gap-4">{children}</div>
    </>
  );
}
