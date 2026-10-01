import type { Metadata } from "next";
import { SettingsSection } from "@/components/recebi/settings-section";
import { requireUser } from "@/lib/recebi/auth";

export const metadata: Metadata = { title: "Nota fiscal" };

export default async function InvoiceTaxSettingsPage() {
  await requireUser();
  return (
    <SettingsSection title="Nota fiscal de serviço" description="Emita NFS-e direto das suas cobranças.">
      <p className="text-sm text-muted-foreground">Em breve.</p>
    </SettingsSection>
  );
}
