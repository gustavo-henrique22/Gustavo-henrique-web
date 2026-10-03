import { ArrowLeft, Landmark, ShieldCheck, Trash2, Wand2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/recebi/confirm-action";
import { PageHeader } from "@/components/recebi/page-header";
import { ProNotice } from "@/components/recebi/pro-notice";
import { NewRuleButton } from "@/components/recebi/rule-dialog";
import { StatementImporter } from "@/components/recebi/statement-importer";
import { deleteCategoryRule } from "@/lib/recebi/actions/statement";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { listCategoryRules } from "@/lib/recebi/data";

export const metadata: Metadata = { title: "Importar extrato" };

const BANKS: [string, string][] = [
  ["Nubank", "Conta → Extrato → ícone de compartilhar → Exportar extrato (OFX ou CSV)"],
  ["Inter", "Extrato → Exportar → escolha o período e o formato OFX"],
  ["Itaú, Bradesco, Santander, BB e Caixa", "No internet banking, abra o extrato e procure por “Salvar como” ou “Exportar” → OFX (Money)"],
  ["Mercado Pago, PicPay e outros", "Seu dinheiro → Relatórios → Baixar extrato em CSV"],
];

export default async function ImportStatementPage() {
  const user = await requireUser();
  const pro = hasPro(user);
  const rules = pro ? await listCategoryRules(user.id) : [];

  return (
    <>
      <Link
        href={`${APP_PATH}/lancamentos`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Lançamentos
      </Link>
      <PageHeader
        title="Importar extrato"
        description="Traga as movimentações do seu banco em segundos, já categorizadas. Nada de digitar lançamento por lançamento."
      />

      {!pro ? (
        <ProNotice text="Importar o extrato do banco, com categorias automáticas e baixa de cobranças, é um recurso do plano Pro." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <StatementImporter />
          </div>

          <aside className="grid content-start gap-4">
            <section className="rounded-2xl border bg-card p-5 shadow-xs">
              <h2 className="flex items-center gap-2 font-bold">
                <Landmark className="size-4" /> Como baixar o extrato
              </h2>
              <ul className="mt-3 grid gap-3 text-sm">
                {BANKS.map(([bank, how]) => (
                  <li key={bank}>
                    <p className="font-semibold">{bank}</p>
                    <p className="text-xs text-muted-foreground">{how}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0" /> O arquivo é lido no seu navegador. Guardamos só as transações que você escolher
                importar.
              </p>
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-bold">
                  <Wand2 className="size-4" /> Suas regras
                </h2>
                <NewRuleButton />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Ensine o Recebi a categorizar do seu jeito. As regras valem para as próximas importações.
              </p>
              {rules.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nenhuma regra ainda. Ao trocar uma categoria na revisão, marque “Sempre que tiver…” para criar uma.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {rules.map((rule) => (
                    <li key={rule.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">“{rule.pattern}”</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {rule.type === "receita" ? "Receita" : "Despesa"} · {rule.category}
                        </span>
                      </span>
                      <ConfirmAction
                        title="Excluir esta regra?"
                        description="As importações futuras voltam a usar a sugestão automática."
                        confirmLabel="Excluir"
                        action={deleteCategoryRule}
                        fields={{ id: rule.id }}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir regra ${rule.pattern}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
