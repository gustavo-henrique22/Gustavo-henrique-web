"use client";

import { Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveInvoice } from "@/lib/recebi/actions/invoices";
import { APP_PATH } from "@/lib/recebi/config";
import { centsToInput, formatMoney, parseMoney } from "@/lib/recebi/money";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

type Option = { id: string; name: string; clientId?: string | null };

type Item = { key: number; description: string; quantity: string; price: string };

export type InvoiceDraft = {
  id?: string;
  status?: string;
  clientId?: string | null;
  projectId?: string | null;
  issueDate: string;
  dueDate: string;
  discountCents: number;
  notes: string;
  items: { description: string; quantity: number; unitPriceCents: number }[];
};

const selectClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover";

let nextKey = 1;

export function InvoiceEditor({ draft, clients, projects }: { draft: InvoiceDraft; clients: Option[]; projects: Option[] }) {
  const { state, pending, onSubmit } = useActionForm(saveInvoice);
  const [clientId, setClientId] = useState(draft.clientId ?? "");
  const [discount, setDiscount] = useState(draft.discountCents ? centsToInput(draft.discountCents) : "");
  const [items, setItems] = useState<Item[]>(() =>
    (draft.items.length ? draft.items : [{ description: "", quantity: 1, unitPriceCents: 0 }]).map((item) => ({
      key: nextKey++,
      description: item.description,
      quantity: String(item.quantity).replace(".", ","),
      price: item.unitPriceCents ? centsToInput(item.unitPriceCents) : "",
    })),
  );

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const qty = Number(item.quantity.replace(",", ".")) || 0;
        const price = parseMoney(item.price) ?? 0;
        return sum + Math.round(qty * price);
      }, 0),
    [items],
  );
  const discountCents = parseMoney(discount) ?? 0;
  const total = subtotal - discountCents;
  const clientProjects = projects.filter((p) => !clientId || !p.clientId || p.clientId === clientId);

  const update = (key: number, patch: Partial<Item>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const isDraft = !draft.status || draft.status === "rascunho";

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}

      <div className="grid content-start gap-6">
        <section className="grid gap-4 rounded-2xl border bg-card p-5 shadow-xs sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="clientId">Cliente</Label>
            {clients.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Você ainda não tem clientes.{" "}
                <Link href={`${APP_PATH}/clientes`} className="font-semibold text-foreground underline">
                  Cadastre um cliente
                </Link>{" "}
                para criar a cobrança.
              </p>
            ) : (
              <select
                id="clientId"
                name="clientId"
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={selectClass}
              >
                <option value="" disabled>
                  Escolha um cliente
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="issueDate">Emissão</Label>
            <Input id="issueDate" name="issueDate" type="date" required defaultValue={draft.issueDate} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dueDate">Vencimento</Label>
            <Input id="dueDate" name="dueDate" type="date" required defaultValue={draft.dueDate} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="projectId">
              Projeto <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <select id="projectId" name="projectId" defaultValue={draft.projectId ?? ""} className={selectClass}>
              <option value="">Nenhum</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="mb-4 font-bold">Itens</h2>
          <div className="hidden grid-cols-[1fr_80px_130px_110px_36px] gap-2 px-1 pb-2 text-xs font-medium text-muted-foreground sm:grid">
            <span>Descrição</span>
            <span>Qtd.</span>
            <span>Valor unitário</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          <ul className="grid gap-3 sm:gap-2">
            {items.map((item, index) => {
              const qty = Number(item.quantity.replace(",", ".")) || 0;
              const lineTotal = Math.round(qty * (parseMoney(item.price) ?? 0));
              return (
                <li
                  key={item.key}
                  className="grid grid-cols-[1fr_80px_1fr_36px] gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_80px_130px_110px_36px] sm:items-center sm:rounded-none sm:border-0 sm:p-0"
                >
                  <Input
                    name="itemDescription"
                    aria-label={`Descrição do item ${index + 1}`}
                    placeholder="Ex.: Criação de logotipo"
                    value={item.description}
                    onChange={(e) => update(item.key, { description: e.target.value })}
                    className="col-span-4 sm:col-span-1"
                    maxLength={200}
                  />
                  <Input
                    name="itemQuantity"
                    aria-label={`Quantidade do item ${index + 1}`}
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) => update(item.key, { quantity: e.target.value })}
                    className="tabular"
                  />
                  <Input
                    name="itemPrice"
                    aria-label={`Valor unitário do item ${index + 1}`}
                    inputMode="decimal"
                    placeholder="0,00"
                    value={item.price}
                    onChange={(e) => update(item.key, { price: e.target.value })}
                    className="tabular"
                  />
                  <span className="hidden text-right text-sm font-semibold tabular sm:block">{formatMoney(lineTotal)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover item ${index + 1}`}
                    disabled={items.length === 1}
                    onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={items.length >= 30}
            onClick={() => setItems((list) => [...list, { key: nextKey++, description: "", quantity: "1", price: "" }])}
          >
            <Plus /> Adicionar item
          </Button>
        </section>

        <section className="grid gap-2 rounded-2xl border bg-card p-5 shadow-xs">
          <Label htmlFor="notes">
            Observações para o cliente <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={draft.notes}
            maxLength={2000}
            placeholder="Ex.: Pagamento via Pix. Após a confirmação, envio os arquivos finais."
          />
        </section>
      </div>

      <aside className="grid content-start gap-4 lg:sticky lg:top-6">
        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="mb-4 font-bold">Resumo</h2>
          <dl className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-semibold tabular">{formatMoney(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>
                <Label htmlFor="discount" className="font-normal text-muted-foreground">
                  Desconto
                </Label>
              </dt>
              <dd className="w-32">
                <Input
                  id="discount"
                  name="discount"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-8 text-right tabular"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <dt className="font-bold">Total</dt>
              <dd className="text-xl font-extrabold tabular">{formatMoney(Math.max(total, 0))}</dd>
            </div>
          </dl>
        </section>
        <FormError message={state.error} />
        <div className="grid gap-2">
          {isDraft ? (
            <>
              <SubmitButton
                pending={pending}
                name="intent"
                value="enviar"
                size="lg"
                disabled={clients.length === 0}
                pendingLabel="Gerando link…"
              >
                <Send /> Salvar e gerar link
              </SubmitButton>
              <SubmitButton pending={pending} name="intent" value="rascunho" variant="outline" disabled={clients.length === 0}>
                Salvar rascunho
              </SubmitButton>
            </>
          ) : (
            <SubmitButton pending={pending} name="intent" value="salvar" size="lg">
              Salvar alterações
            </SubmitButton>
          )}
          <Button asChild variant="ghost">
            <Link href={draft.id ? `${APP_PATH}/cobrancas/${draft.id}` : `${APP_PATH}/cobrancas`}>Cancelar</Link>
          </Button>
        </div>
      </aside>
    </form>
  );
}
