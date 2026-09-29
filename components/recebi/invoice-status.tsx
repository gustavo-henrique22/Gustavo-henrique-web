import { Badge } from "@/components/ui/badge";
import { todayISO } from "@/lib/recebi/dates";
import { cn } from "@/lib/utils";

export type InvoiceStatus = "rascunho" | "enviada" | "paga" | "cancelada";

export function invoiceDisplayStatus(status: InvoiceStatus, dueDate: string) {
  if (status === "enviada" && dueDate < todayISO()) return "vencida" as const;
  return status;
}

const LABELS = { rascunho: "Rascunho", enviada: "Aguardando", paga: "Paga", cancelada: "Cancelada", vencida: "Vencida" } as const;

export function InvoiceStatusBadge({ status, dueDate, className }: { status: InvoiceStatus; dueDate: string; className?: string }) {
  const display = invoiceDisplayStatus(status, dueDate);
  return (
    <Badge
      variant="outline"
      className={cn(
        display === "paga" && "border-income/30 bg-income/10 text-income",
        display === "enviada" && "border-warning/30 bg-warning/10 text-warning",
        display === "vencida" && "border-destructive/30 bg-destructive/10 text-destructive",
        display === "cancelada" && "text-muted-foreground line-through",
        display === "rascunho" && "text-muted-foreground",
        className,
      )}
    >
      {LABELS[display]}
    </Badge>
  );
}
