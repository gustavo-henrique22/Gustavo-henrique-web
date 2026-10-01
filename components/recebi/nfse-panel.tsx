import {
  Ban,
  CircleAlert,
  CircleCheck,
  Clock,
  FileCode2,
  FileText,
  FlaskConical,
  Receipt,
  RefreshCw,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  Client,
  Invoice,
  InvoiceItem,
  NfseDocument,
  User,
} from "@/db/schema";
import {
  cancelInvoiceNfse,
  emitInvoiceNfse,
  refreshInvoiceNfse,
} from "@/lib/recebi/actions/nfse";
import { hasPro } from "@/lib/recebi/auth";
import { APP_PATH, BASE_PATH } from "@/lib/recebi/config";
import { formatDateTime } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import {
  getNfseSettings,
  listInvoiceNfse,
  nfseMissing,
} from "@/lib/recebi/nfse";
import { cn } from "@/lib/utils";
import { ActionButton } from "./action-button";
import { FormField, MoneyInput } from "./fields";
import { FormDialog } from "./form-dialog";

const STATUS: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
  }
> = {
  processando: {
    label: "Em processamento",
    icon: Clock,
    className: "bg-warning/15 text-warning",
  },
  autorizado: {
    label: "Autorizada",
    icon: CircleCheck,
    className: "bg-income/15 text-income",
  },
  erro: {
    label: "Não autorizada",
    icon: CircleAlert,
    className: "bg-destructive/10 text-destructive",
  },
  cancelado: {
    label: "Cancelada",
    icon: Ban,
    className: "bg-muted text-muted-foreground",
  },
};

function serviceDescription(items: InvoiceItem[], fallback: string) {
  const text = items
    .map((item) =>
      item.quantity !== 1
        ? `${item.quantity}× ${item.description}`
        : item.description,
    )
    .join("; ");
  return text || fallback;
}

function NfseRow({ doc }: { doc: NfseDocument }) {
  const status = STATUS[doc.status] ?? STATUS.processando;
  const Icon = status.icon;
  return (
    <li className="grid gap-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            status.className,
          )}
        >
          <Icon className="size-3.5" /> {status.label}
        </span>
        {doc.numero ? (
          <span className="text-sm font-semibold">Nº {doc.numero}</span>
        ) : null}
        {doc.environment === "homologacao" ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <FlaskConical className="size-3.5" /> teste
          </span>
        ) : null}
        <span className="ml-auto text-sm font-semibold tabular">
          {formatMoney(doc.amountCents)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground" suppressHydrationWarning>
        Pedida em {formatDateTime(doc.createdAt)}
        {doc.codigoVerificacao
          ? ` · código de verificação ${doc.codigoVerificacao}`
          : ""}
      </p>
      {doc.message ? (
        <p
          className={cn(
            "text-sm",
            doc.status === "erro"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {doc.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {doc.pdfUrl && doc.status !== "erro" ? (
          <Button asChild size="sm" variant="outline">
            <a href={doc.pdfUrl} target="_blank" rel="noreferrer">
              <FileText /> Ver nota (PDF)
            </a>
          </Button>
        ) : null}
        {doc.xmlUrl && doc.status !== "erro" ? (
          <Button asChild size="sm" variant="ghost">
            <a href={doc.xmlUrl} target="_blank" rel="noreferrer">
              <FileCode2 /> XML
            </a>
          </Button>
        ) : null}
        {doc.status === "processando" || doc.status === "autorizado" ? (
          <ActionButton
            action={refreshInvoiceNfse}
            fields={{ id: doc.id }}
            size="sm"
            variant="ghost"
          >
            <RefreshCw /> Atualizar
          </ActionButton>
        ) : null}
        {doc.status === "autorizado" ? (
          <FormDialog
            title={`Cancelar a nota${doc.numero ? ` nº ${doc.numero}` : ""}?`}
            description="O cancelamento vai para a prefeitura e não pode ser desfeito. Algumas cidades só aceitam dentro de um prazo."
            action={cancelInvoiceNfse}
            submitLabel="Cancelar nota"
            trigger={
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
              >
                <Ban /> Cancelar
              </Button>
            }
          >
            <input type="hidden" name="id" value={doc.id} />
            <FormField
              id={`reason-${doc.id}`}
              label="Motivo do cancelamento"
              hint="Mínimo de 15 caracteres."
            >
              <Textarea
                id={`reason-${doc.id}`}
                name="reason"
                rows={3}
                minLength={15}
                maxLength={255}
                required
                placeholder="Ex.: Nota emitida com o valor errado."
              />
            </FormField>
          </FormDialog>
        ) : null}
      </div>
    </li>
  );
}

/** Bloco "Nota fiscal" na tela da cobrança: emitir, acompanhar e cancelar a NFS-e. */
export async function NfsePanel({
  user,
  invoice,
  client,
  items,
}: {
  user: User;
  invoice: Invoice;
  client: Client | null;
  items: InvoiceItem[];
}) {
  if (invoice.status !== "enviada" && invoice.status !== "paga") return null;

  const header = (
    <h2 className="flex items-center gap-2 font-bold">
      <Receipt className="size-5" /> Nota fiscal
    </h2>
  );

  if (!hasPro(user) || user.isDemo) {
    return (
      <section
        id="nota-fiscal"
        className="scroll-mt-24 rounded-2xl border bg-card p-5 shadow-xs"
      >
        {header}
        <p className="mt-1 text-sm text-muted-foreground">
          {user.isDemo
            ? "Na sua conta, você emite a nota fiscal desta cobrança com um clique."
            : "Com o Pro, você emite a nota fiscal (NFS-e) desta cobrança com um clique."}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link
            href={user.isDemo ? `${BASE_PATH}/cadastro` : `${APP_PATH}/plano`}
          >
            {user.isDemo ? "Criar minha conta" : "Conhecer o Pro"}
          </Link>
        </Button>
      </section>
    );
  }

  const [settings, docs] = await Promise.all([
    getNfseSettings(user.id),
    listInvoiceNfse(user.id, invoice.id),
  ]);
  const missing = nfseMissing(settings);
  const active = docs.find(
    (doc) => doc.status === "processando" || doc.status === "autorizado",
  );
  const defaultDescription = serviceDescription(
    items,
    settings?.descricaoPadrao ?? "",
  );

  return (
    <section
      id="nota-fiscal"
      className="scroll-mt-24 rounded-2xl border bg-card p-5 shadow-xs"
    >
      {header}
      {docs.length ? (
        <ul className="mt-3 grid gap-2">
          {docs.slice(0, 5).map((doc) => (
            <NfseRow key={doc.id} doc={doc} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          {missing.length
            ? "Configure uma vez e emita a NFS-e desta cobrança com um clique."
            : "Nenhuma nota emitida para esta cobrança."}
        </p>
      )}

      {missing.length ? (
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href={`${APP_PATH}/configuracoes/nota-fiscal`}>
            <Settings /> Configurar nota fiscal
          </Link>
        </Button>
      ) : !active ? (
        <FormDialog
          title="Emitir nota fiscal"
          description={
            settings?.environment === "producao"
              ? "Nota real, enviada à prefeitura. Confira os dados antes."
              : "Ambiente de teste: a nota não tem valor fiscal."
          }
          action={emitInvoiceNfse}
          submitLabel="Emitir nota"
          trigger={
            <Button
              className="mt-3 w-full"
              variant={docs.length ? "outline" : "default"}
            >
              <Receipt />{" "}
              {docs.length ? "Emitir de novo" : "Emitir nota fiscal"}
            </Button>
          }
        >
          <input type="hidden" name="id" value={invoice.id} />
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Tomador (cliente)
            </p>
            <p className="font-medium">{client?.name ?? "Sem cliente"}</p>
            <p className="text-muted-foreground">
              {client?.document
                ? `CPF/CNPJ ${client.document}`
                : "Sem CPF/CNPJ cadastrado (algumas cidades exigem)."}
              {client?.email ? ` · ${client.email}` : ""}
            </p>
          </div>
          <FormField id="nfse-description" label="Descrição do serviço">
            <Textarea
              id="nfse-description"
              name="description"
              rows={4}
              maxLength={2000}
              required
              defaultValue={defaultDescription}
            />
          </FormField>
          <FormField id="nfse-amount" label="Valor do serviço">
            <MoneyInput
              id="nfse-amount"
              name="amount"
              required
              defaultCents={invoice.totalCents}
            />
          </FormField>
        </FormDialog>
      ) : null}

      {settings?.environment === "homologacao" && !missing.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <FlaskConical className="mr-1 inline size-3.5 align-[-2px]" />
          Modo de teste. Para emitir notas reais, troque para produção em{" "}
          <Link
            href={`${APP_PATH}/configuracoes/nota-fiscal`}
            className="underline underline-offset-2"
          >
            Configurações
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}
