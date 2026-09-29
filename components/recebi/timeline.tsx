import { Ban, Bell, Check, CheckCheck, Eye, FilePlus2, Mail, Repeat, Send, ThumbsDown, Undo2, Wallet } from "lucide-react";
import { EVENT_LABELS } from "@/lib/recebi/activity";
import { formatDateTime, formatRelative } from "@/lib/recebi/dates";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  criado: FilePlus2,
  enviado: Send,
  email: Mail,
  visualizado: Eye,
  aprovado: CheckCheck,
  "aprovado-manual": Check,
  recusado: ThumbsDown,
  convertido: Wallet,
  lembrete: Bell,
  pago: Wallet,
  "pagamento-desfeito": Undo2,
  cancelado: Ban,
  recorrente: Repeat,
  "pedido-site": FilePlus2,
};

const TONES: Record<string, string> = {
  visualizado: "bg-[#c9ff3c] text-[#101c34]",
  aprovado: "bg-income text-white",
  "aprovado-manual": "bg-income text-white",
  pago: "bg-income text-white",
  recusado: "bg-destructive text-white",
  cancelado: "bg-muted-foreground text-white",
};

type Event = { id: string; type: string; detail: string; createdAt: string };

/** Histórico do documento: o que aconteceu e quando (inclusive quando o cliente abriu o link). */
export function DocumentTimeline({ events, viewCount, viewedAt }: { events: Event[]; viewCount: number; viewedAt: string | null }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-xs" aria-labelledby="timeline-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="timeline-title" className="font-bold">
          Histórico
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            viewCount > 0 ? "bg-[#c9ff3c] text-[#101c34]" : "bg-muted text-muted-foreground",
          )}
          title={viewedAt ? `Aberto pela primeira vez em ${formatDateTime(viewedAt)}` : undefined}
        >
          <Eye className="size-3.5" />
          {viewCount > 0 ? `Visto ${viewCount}×` : "Ainda não visto"}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada registrado ainda.</p>
      ) : (
        <ol className="relative grid gap-4 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-border">
          {events.map((event) => {
            const Icon = ICONS[event.type] ?? Check;
            return (
              <li key={event.id} className="relative flex gap-3">
                <span className={cn("z-10 grid size-7 shrink-0 place-items-center rounded-full border bg-card", TONES[event.type])}>
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-medium">{EVENT_LABELS[event.type] ?? event.type}</p>
                  {event.detail ? <p className="text-xs break-words text-muted-foreground">{event.detail}</p> : null}
                  <p className="text-xs text-muted-foreground" title={formatDateTime(event.createdAt)}>
                    {formatRelative(event.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
