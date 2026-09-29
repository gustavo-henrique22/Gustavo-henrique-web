"use client";

import { Play, Square, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { startTimer, stopTimer } from "@/lib/recebi/actions/time";
import { APP_PATH } from "@/lib/recebi/config";
import { cn } from "@/lib/utils";
import { ActionButton } from "./action-button";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

function format(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Relógio que conta desde o início do cronômetro. */
export function ElapsedClock({ startedAt, className }: { startedAt: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const seconds = now === null ? 0 : Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  return <span className={cn("font-mono tabular-nums", className)}>{now === null ? "--:--:--" : format(seconds)}</span>;
}

type Running = { startedAt: string; description: string; projectName: string | null } | null;

export function TimerCard({ running, projects }: { running: Running; projects: { id: string; name: string }[] }) {
  const { state, pending, onSubmit } = useActionForm(startTimer);

  if (running) {
    return (
      <section className="relative overflow-hidden rounded-2xl bg-[#101c34] p-6 text-white shadow-lg">
        <div aria-hidden className="absolute -top-16 -right-16 size-56 animate-pulse rounded-full bg-[#c9ff3c]/10 blur-2xl" />
        <p className="relative flex items-center gap-2 text-sm text-white/70">
          <span className="size-2 animate-pulse rounded-full bg-[#c9ff3c]" /> Cronômetro rodando
          {running.projectName ? ` · ${running.projectName}` : ""}
        </p>
        <ElapsedClock startedAt={running.startedAt} className="relative mt-2 block text-5xl font-bold text-[#c9ff3c]" />
        {running.description ? <p className="relative mt-1 text-sm text-white/70">{running.description}</p> : null}
        <ActionButton action={stopTimer} fields={{}} size="lg" className="relative mt-5 bg-white text-[#101c34] hover:bg-white/90">
          <Square className="fill-current" /> Parar e salvar
        </ActionButton>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-xs">
      <p className="flex items-center gap-2 font-bold">
        <Timer className="size-4" /> Começar a contar
      </p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <select
          name="projectId"
          defaultValue=""
          aria-label="Projeto"
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm dark:bg-input/30 [&>option]:bg-popover"
        >
          <option value="">Sem projeto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Input name="description" placeholder="No que você vai trabalhar?" maxLength={200} className="h-10" aria-label="Descrição" />
        <SubmitButton pending={pending} size="lg" className="h-10" pendingLabel="Iniciando…">
          <Play className="fill-current" /> Iniciar
        </SubmitButton>
      </form>
      <FormError message={state.error} />
    </section>
  );
}

/** Aviso pequeno no topo do painel enquanto o cronômetro roda. */
export function RunningTimerPill({ startedAt, label }: { startedAt: string; label: string | null }) {
  return (
    <Link
      href={`${APP_PATH}/horas`}
      className="inline-flex items-center gap-2 rounded-full bg-[#101c34] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1b2b4d] dark:bg-[#c9ff3c] dark:text-[#101c34]"
      title="Abrir controle de horas"
    >
      <span className="size-2 animate-pulse rounded-full bg-[#c9ff3c] dark:bg-[#101c34]" />
      <ElapsedClock startedAt={startedAt} />
      {label ? <span className="hidden max-w-32 truncate sm:inline">· {label}</span> : null}
    </Link>
  );
}
