import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
  delta,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  /** Variação em relação ao período anterior. */
  delta?: { percent: number | null; positiveIsGood: boolean; label: string };
  icon?: React.ReactNode;
  tone?: "default" | "income" | "expense" | "warning" | "brand";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 text-card-foreground shadow-xs",
        tone === "brand" && "border-transparent bg-[#101c34] text-white dark:bg-[#c9ff3c] dark:text-[#101c34]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-sm font-medium text-muted-foreground", tone === "brand" && "text-white/70 dark:text-[#101c34]/70")}>
          {label}
        </p>
        {icon ? (
          <span
            className={cn(
              "grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4",
              tone === "income" && "bg-income/10 text-income",
              tone === "expense" && "bg-expense/10 text-expense",
              tone === "warning" && "bg-warning/10 text-warning",
              tone === "brand" && "bg-white/10 text-[#c9ff3c] dark:bg-[#101c34]/10 dark:text-[#101c34]",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-extrabold tracking-tight tabular sm:text-[1.7rem]">{value}</p>
      {delta && delta.percent !== null ? (
        <p
          className={cn(
            "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-bold tabular",
            delta.percent === 0
              ? "bg-muted text-muted-foreground"
              : delta.percent > 0 === delta.positiveIsGood
                ? "bg-income/10 text-income"
                : "bg-expense/10 text-expense",
            tone === "brand" && "bg-white/10 text-inherit dark:bg-[#101c34]/10",
          )}
        >
          {delta.percent > 0 ? "▲" : delta.percent < 0 ? "▼" : "•"} {Math.abs(delta.percent)}% {delta.label}
        </p>
      ) : null}
      {hint ? (
        <div className={cn("mt-1 text-xs text-muted-foreground", tone === "brand" && "text-white/70 dark:text-[#101c34]/70")}>{hint}</div>
      ) : null}
    </div>
  );
}
