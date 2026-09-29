"use client";

import { ArrowLeftRight, CheckCircle2, FileUp, Link2, ListChecks, Loader2, RotateCcw, Sparkles, User, Wand2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { analyzeStatement, importStatement, type AnalyzedRow } from "@/lib/recebi/actions/statement";
import { categoriesFor } from "@/lib/recebi/categories";
import { APP_PATH } from "@/lib/recebi/config";
import { formatDateShort } from "@/lib/recebi/dates";
import { formatMoney } from "@/lib/recebi/money";
import { guessKeyword, parseStatement, type StatementRow } from "@/lib/recebi/statement";
import { cn } from "@/lib/utils";
import { Select } from "./fields";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

type ReviewRow = AnalyzedRow & { include: boolean; reconcile: boolean; remember: boolean; suggested: string };

const MAX_FILE_BYTES = 3 * 1024 * 1024;

/** Bancos brasileiros ainda exportam em Windows-1252; tentamos UTF-8 primeiro. */
async function readText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

export function StatementImporter() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<StatementRow[] | null>(null);
  const [inverted, setInverted] = useState(false);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, startAnalyze] = useTransition();
  const [dismissedAt, setDismissedAt] = useState<number | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const { state, pending, onSubmit } = useActionForm(importStatement);
  const done = state.ok && state.at !== dismissedAt;

  function analyze(source: StatementRow[], invert: boolean) {
    setError(null);
    startAnalyze(async () => {
      const result = await analyzeStatement(invert ? source.map((r) => ({ ...r, amountCents: -r.amountCents })) : source);
      if ("error" in result) {
        setError(result.error);
        setRows(null);
        return;
      }
      setRows(result.rows.map((r) => ({ ...r, include: !r.duplicate, reconcile: !!r.invoice, remember: false, suggested: r.category })));
    });
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) return setError("Arquivo grande demais (máximo 3 MB). Exporte um período menor.");
    const result = parseStatement(await readText(file), file.name);
    if ("error" in result) return setError(result.error);
    setFileName(file.name);
    setParsed(result.rows);
    setInverted(false);
    analyze(result.rows, false);
  }

  function reset() {
    setFileName(null);
    setParsed(null);
    setRows(null);
    setError(null);
    setDismissedAt(state.at);
    if (input.current) input.current.value = "";
  }

  function update(index: number, patch: Partial<ReviewRow>) {
    setRows((current) => current && current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const selected = useMemo(() => rows?.filter((r) => r.include) ?? [], [rows]);
  const totals = useMemo(
    () =>
      selected.reduce(
        (acc, r) =>
          r.type === "receita" ? { ...acc, income: acc.income + r.amountCents } : { ...acc, expense: acc.expense - r.amountCents },
        { income: 0, expense: 0 },
      ),
    [selected],
  );

  const payload = useMemo(
    () =>
      JSON.stringify(
        selected.map((r) => ({
          externalId: r.externalId,
          date: r.date,
          description: r.description,
          amountCents: Math.abs(r.amountCents),
          type: r.type,
          category: r.category,
          clientId: r.clientId,
          invoiceId: r.reconcile && r.invoice ? r.invoice.id : null,
        })),
      ),
    [selected],
  );
  const rulesPayload = useMemo(
    () =>
      JSON.stringify(
        (rows ?? [])
          .filter((r) => r.remember && r.category !== r.suggested)
          .map((r) => ({ pattern: guessKeyword(r.description), type: r.type, category: r.category }))
          .filter((r) => r.pattern),
      ),
    [rows],
  );

  if (done) {
    return (
      <section className="rounded-2xl border bg-card p-8 text-center shadow-xs">
        <CheckCircle2 className="mx-auto size-12 text-income" />
        <h2 className="mt-3 text-xl font-extrabold">Extrato importado!</h2>
        <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={`${APP_PATH}/lancamentos`}>Ver lançamentos</Link>
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw /> Importar outro arquivo
          </Button>
        </div>
      </section>
    );
  }

  if (!rows) {
    return (
      <section className="rounded-2xl border bg-card p-5 shadow-xs">
        <label
          htmlFor="statement-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition",
            dragging ? "border-primary bg-primary/5" : "hover:border-foreground/30 hover:bg-muted/40",
          )}
        >
          {analyzing ? (
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
          ) : (
            <span className="grid size-14 place-items-center rounded-2xl bg-[#c9ff3c] text-[#101c34]">
              <FileUp className="size-7" />
            </span>
          )}
          <span className="text-lg font-bold">{analyzing ? "Lendo seu extrato…" : "Arraste o arquivo do extrato aqui"}</span>
          <span className="max-w-md text-sm text-muted-foreground">
            ou clique para escolher. Aceitamos <strong>OFX</strong> (o mais completo) e <strong>CSV</strong>, de qualquer banco.
          </span>
          <input
            ref={input}
            id="statement-file"
            type="file"
            accept=".ofx,.qfx,.csv,.txt,text/csv,application/x-ofx"
            className="sr-only"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </label>
        <FormError message={error ?? undefined} />
      </section>
    );
  }

  const duplicates = rows.filter((r) => r.duplicate).length;
  const reconciles = selected.filter((r) => r.reconcile && r.invoice).length;

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="rows" value={payload} />
      <input type="hidden" name="rules" value={rulesPayload} />

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-xs">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{fileName}</p>
          <p className="text-xs text-muted-foreground">
            {rows.length} transações · {selected.length} selecionadas
            {duplicates > 0 ? ` · ${duplicates} já importadas antes` : ""}
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <span>
            <span className="block text-xs text-muted-foreground">Entradas</span>
            <strong className="text-income">{formatMoney(totals.income)}</strong>
          </span>
          <span>
            <span className="block text-xs text-muted-foreground">Saídas</span>
            <strong className="text-expense">{formatMoney(totals.expense)}</strong>
          </span>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={analyzing}
            title="Use quando o arquivo é da fatura do cartão e as compras vieram como entradas"
            onClick={() => {
              if (!parsed) return;
              setInverted(!inverted);
              analyze(parsed, !inverted);
            }}
          >
            <ArrowLeftRight /> Inverter entradas e saídas
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <RotateCcw /> Trocar arquivo
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Wand2 className="size-4" /> Categorias sugeridas automaticamente. Revise e ajuste o que precisar.
        </p>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setRows(rows.map((r) => ({ ...r, include: !r.duplicate })))}>
            <ListChecks /> Marcar todas
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRows(rows.map((r) => ({ ...r, include: false })))}>
            Desmarcar
          </Button>
        </div>
      </div>

      <ul className={cn("grid gap-2", analyzing && "pointer-events-none opacity-60")}>
        {rows.map((row, index) => {
          const keyword = row.category !== row.suggested ? guessKeyword(row.description) : null;
          return (
            <li
              key={row.externalId}
              className={cn(
                "grid gap-3 rounded-xl border bg-card p-3 shadow-xs sm:grid-cols-[auto_1fr_13rem_8rem] sm:items-center",
                !row.include && "opacity-55",
              )}
            >
              <input
                type="checkbox"
                aria-label={`Importar ${row.description}`}
                checked={row.include}
                disabled={row.duplicate}
                onChange={(e) => update(index, { include: e.target.checked })}
                className="size-4 accent-[var(--primary)]"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={row.description}>
                  {row.description}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDateShort(row.date)}</span>
                  {row.duplicate ? <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">Já importado</span> : null}
                  {row.byRule ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[#c9ff3c]/30 px-1.5 py-0.5 font-semibold text-foreground">
                      <Sparkles className="size-3" /> Sua regra
                    </span>
                  ) : null}
                  {row.clientName ? (
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3" /> {row.clientName}
                    </span>
                  ) : null}
                </p>
                {row.invoice && !row.duplicate ? (
                  <label className="mt-2 flex w-fit items-center gap-2 rounded-lg bg-income/10 px-2 py-1 text-xs font-semibold text-income">
                    <input
                      type="checkbox"
                      checked={row.reconcile}
                      onChange={(e) => update(index, { reconcile: e.target.checked })}
                      className="size-3.5 accent-[var(--color-income)]"
                    />
                    <Link2 className="size-3.5" /> Dar baixa na cobrança #{String(row.invoice.number).padStart(4, "0")}
                  </label>
                ) : null}
                {keyword ? (
                  <label className="mt-2 flex w-fit items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.remember}
                      onChange={(e) => update(index, { remember: e.target.checked })}
                      className="size-3.5 accent-[var(--primary)]"
                    />
                    Sempre que tiver “{keyword}”, usar {row.category}
                  </label>
                ) : null}
              </div>
              <Select
                aria-label={`Categoria de ${row.description}`}
                value={row.category}
                disabled={row.duplicate || (row.reconcile && !!row.invoice)}
                onChange={(e) => update(index, { category: e.target.value })}
              >
                {categoriesFor(row.type).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <p
                className={cn(
                  "text-right font-mono text-sm font-bold tabular-nums",
                  row.type === "receita" ? "text-income" : "text-expense",
                )}
              >
                {row.type === "receita" ? "+" : "−"} {formatMoney(Math.abs(row.amountCents))}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {selected.length === 0
            ? "Selecione ao menos uma transação."
            : `${selected.length} ${selected.length === 1 ? "lançamento" : "lançamentos"}${reconciles > 0 ? ` · ${reconciles} ${reconciles === 1 ? "cobrança recebe" : "cobranças recebem"} baixa` : ""}`}
        </p>
        <div className="flex items-center gap-3">
          <FormError message={state.error} />
          <SubmitButton pending={pending} disabled={selected.length === 0 || analyzing} pendingLabel="Importando…">
            Importar {selected.length > 0 ? selected.length : ""} {selected.length === 1 ? "lançamento" : "lançamentos"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
