import { Link2Off, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regeneratePublicLink, setPublicLinkEnabled } from "@/lib/recebi/actions/links";
import { formatDateTime } from "@/lib/recebi/dates";
import { ActionButton } from "./action-button";
import { ConfirmAction } from "./confirm-action";

type Props = { kind: "cobranca" | "orcamento"; id: string };

/** Aviso mostrado no lugar do link quando ele está desativado. */
export function LinkDisabledNotice({ kind, id, disabledAt }: Props & { disabledAt: string }) {
  return (
    <section className="rounded-2xl border border-warning/40 bg-warning/5 p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <ShieldAlert className="size-5 text-warning" /> Link desativado
      </h2>
      <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
        Desde {formatDateTime(disabledAt)}, quem abrir o endereço vê “página não encontrada”. Reative quando quiser ou gere um link novo.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton action={setPublicLinkEnabled} fields={{ kind, id, enable: "1" }} variant="outline" size="sm">
          Reativar o mesmo link
        </ActionButton>
        <ActionButton action={regeneratePublicLink} fields={{ kind, id }} size="sm">
          <RefreshCw /> Gerar link novo
        </ActionButton>
      </div>
    </section>
  );
}

/** Botões de "Mais ações": trocar ou desativar o link público. */
export function LinkActions({ kind, id }: Props) {
  const noun = kind === "orcamento" ? "orçamento" : "cobrança";
  return (
    <>
      <ConfirmAction
        action={regeneratePublicLink}
        fields={{ kind, id }}
        title="Trocar o link?"
        description={`O endereço atual para de funcionar na hora. Use se o link da ${noun} foi parar com quem não devia. Depois, envie o link novo ao cliente.`}
        confirmLabel="Gerar link novo"
        destructive={false}
        trigger={
          <Button variant="outline" className="justify-start">
            <RefreshCw /> Trocar o link
          </Button>
        }
      />
      <ConfirmAction
        action={setPublicLinkEnabled}
        fields={{ kind, id, enable: "0" }}
        title="Desativar o link?"
        description={`Ninguém consegue abrir a ${noun} pelo link, nem o cliente. Você pode reativar depois.`}
        confirmLabel="Desativar link"
        trigger={
          <Button variant="outline" className="justify-start">
            <Link2Off /> Desativar o link
          </Button>
        }
      />
    </>
  );
}
