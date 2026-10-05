import { CircleAlert, CircleCheck, ExternalLink, FlaskConical, PlugZap } from "lucide-react";
import type { Metadata } from "next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/recebi/action-button";
import { ActionForm } from "@/components/recebi/action-form";
import { FormField, Select } from "@/components/recebi/fields";
import { ProNotice } from "@/components/recebi/pro-notice";
import { SettingsSection } from "@/components/recebi/settings-section";
import { saveNfseSettings, testNfseConnection } from "@/lib/recebi/actions/nfse";
import { hasPro, requireActor } from "@/lib/recebi/auth";
import { getNfseSettings, nfseMissing, nfseToken } from "@/lib/recebi/nfse";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Nota fiscal" };

const STEPS = [
  "Crie sua conta na Focus NFe e cadastre sua empresa (com o certificado digital, se a sua cidade pedir).",
  "No painel da Focus NFe, copie o token de homologação (teste) e cole aqui embaixo.",
  "Emita uma nota de teste em uma cobrança. Deu certo? Troque para o token de produção.",
];

function formatCnpj(value: string) {
  return value.length === 14 ? value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : value;
}

export default async function InvoiceTaxSettingsPage() {
  const user = await requireActor();

  if (!hasPro(user)) {
    return (
      <SettingsSection
        title="Nota fiscal de serviço"
        description="Emita a NFS-e direto das suas cobranças, sem abrir o site da prefeitura."
      >
        <ProNotice text="A emissão de nota fiscal (NFS-e) faz parte do plano Pro." />
      </SettingsSection>
    );
  }

  const settings = await getNfseSettings(user.id);
  const token = settings ? await nfseToken(settings) : "";
  const missing = nfseMissing(settings);
  const layout = settings?.layout ?? "nacional";
  const production = settings?.environment === "producao";

  return (
    <>
      <SettingsSection
        title="Como funciona"
        description="O Recebi emite a nota pela Focus NFe, uma emissora autorizada que conversa com a prefeitura por você."
      >
        <ol className="grid gap-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#c9ff3c] text-xs font-bold text-[#101c34]">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <a
          href="https://focusnfe.com.br/"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
        >
          Abrir a Focus NFe <ExternalLink className="size-3.5" />
        </a>
        <p className="mt-3 text-xs text-muted-foreground">
          A Focus NFe cobra pelo serviço direto de você. Os dados da nota (seu CNPJ, nome e CPF/CNPJ do cliente, valor e descrição) são
          enviados a ela só quando você emite.
        </p>
      </SettingsSection>

      <SettingsSection
        id="configurar"
        title="Dados para emitir"
        description={
          <>
            Confira os códigos com seu contador ou no guia da sua cidade na Focus NFe.
            <span
              className={cn(
                "mt-3 flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                missing.length ? "bg-warning/15 text-warning" : "bg-income/15 text-income",
              )}
            >
              {missing.length ? <CircleAlert className="size-3.5" /> : <CircleCheck className="size-3.5" />}
              {missing.length ? "Falta preencher" : production ? "Pronto · notas reais" : "Pronto · modo de teste"}
            </span>
            {missing.length ? <span className="mt-2 block text-xs">Falta: {missing.join(", ")}.</span> : null}
          </>
        }
      >
        <ActionForm action={saveNfseSettings} submitLabel="Salvar configuração">
          <div className="group/nfse grid gap-5">
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Padrão da nota</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "nacional", title: "NFS-e Nacional", text: "Obrigatória para MEI e usada por cada vez mais cidades." },
                  { value: "municipal", title: "Sistema da prefeitura", text: "Para cidades com sistema próprio (ME, EPP e outros)." },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer gap-3 rounded-xl border p-3 has-[:checked]:border-[#101c34] has-[:checked]:bg-muted/50 dark:has-[:checked]:border-[#c9ff3c]"
                  >
                    <input
                      type="radio"
                      id={`layout-${option.value}`}
                      name="layout"
                      value={option.value}
                      defaultChecked={layout === option.value}
                      className="mt-1 size-4 accent-[var(--primary)]"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{option.title}</span>
                      <span className="block text-xs text-muted-foreground">{option.text}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="environment"
                label="Ambiente"
                hint={production ? "Notas reais, com valor fiscal." : "Notas de teste, sem valor fiscal. Comece por aqui."}
              >
                <Select id="environment" name="environment" defaultValue={settings?.environment ?? "homologacao"}>
                  <option value="homologacao">Homologação (teste)</option>
                  <option value="producao">Produção (notas reais)</option>
                </Select>
              </FormField>
              <FormField
                id="token"
                label="Token da Focus NFe"
                hint={
                  token
                    ? `Token salvo e criptografado (termina em ${token.slice(-4)}). Deixe em branco para manter.`
                    : "Fica guardado criptografado."
                }
              >
                <Input
                  id="token"
                  name="token"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={token ? "••••••••••••" : "Cole o token aqui"}
                />
              </FormField>
              <FormField id="cnpj" label="CNPJ da sua empresa">
                <Input
                  id="cnpj"
                  name="cnpj"
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  defaultValue={formatCnpj(settings?.cnpj ?? "")}
                />
              </FormField>
              <FormField id="regime" label="Regime">
                <Select id="regime" name="regime" defaultValue={settings?.regime ?? "mei"}>
                  <option value="mei">MEI</option>
                  <option value="simples">Simples Nacional (ME/EPP)</option>
                  <option value="outro">Outro (Lucro Presumido/Real)</option>
                </Select>
              </FormField>
              <FormField id="codigoMunicipio" label="Código IBGE da cidade" hint="7 números. Ex.: São Paulo é 3550308.">
                <Input
                  id="codigoMunicipio"
                  name="codigoMunicipio"
                  inputMode="numeric"
                  maxLength={7}
                  defaultValue={settings?.codigoMunicipio ?? ""}
                />
              </FormField>
              <FormField id="inscricaoMunicipal" label="Inscrição municipal" hint="Se a sua cidade exigir.">
                <Input id="inscricaoMunicipal" name="inscricaoMunicipal" defaultValue={settings?.inscricaoMunicipal ?? ""} />
              </FormField>
              <FormField
                id="codigoTributacao"
                label="Código de tributação"
                hint="Na NFS-e Nacional: 6 números (ex.: 010701). No sistema municipal: o código da prefeitura, se houver."
              >
                <Input id="codigoTributacao" name="codigoTributacao" defaultValue={settings?.codigoTributacao ?? ""} />
              </FormField>
              <FormField
                id="itemListaServico"
                label="Item da lista de serviço"
                hint="Só no sistema da prefeitura. Ex.: 1.07 (suporte em informática)."
                className="group-has-[#layout-nacional:checked]/nfse:opacity-60"
              >
                <Input id="itemListaServico" name="itemListaServico" defaultValue={settings?.itemListaServico ?? ""} />
              </FormField>
              <FormField
                id="aliquota"
                label="Alíquota do ISS (%)"
                hint="Só no sistema da prefeitura. MEI e Simples costumam deixar 0."
                className="group-has-[#layout-nacional:checked]/nfse:opacity-60"
              >
                <Input
                  id="aliquota"
                  name="aliquota"
                  inputMode="decimal"
                  placeholder="0"
                  defaultValue={settings?.aliquotaBp ? String(settings.aliquotaBp / 100).replace(".", ",") : ""}
                />
              </FormField>
            </div>

            <FormField
              id="descricaoPadrao"
              label="Descrição padrão do serviço"
              hint="Usada quando a cobrança não tem descrição. Você pode mudar na hora de emitir."
            >
              <Textarea
                id="descricaoPadrao"
                name="descricaoPadrao"
                rows={3}
                placeholder="Ex.: Serviços de design gráfico conforme combinado."
                defaultValue={settings?.descricaoPadrao ?? ""}
              />
            </FormField>
          </div>
        </ActionForm>
      </SettingsSection>

      <SettingsSection
        id="testar"
        title="Testar a conexão"
        description="Confere se o token funciona no ambiente escolhido, sem emitir nenhuma nota."
      >
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton action={testNfseConnection} fields={{}} variant="outline" disabled={!token}>
            <PlugZap /> Testar conexão
          </ActionButton>
          {!production && token ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <FlaskConical className="size-4" /> Modo de teste: as notas não têm valor fiscal.
            </span>
          ) : null}
        </div>
      </SettingsSection>
    </>
  );
}
