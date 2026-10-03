/** Bloco de configurações: título e explicação à esquerda, formulário à direita. */
export function SettingsSection({
  id,
  title,
  description,
  children,
  danger,
}: {
  id?: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      id={id}
      className={`grid scroll-mt-24 gap-6 rounded-2xl border bg-card p-5 shadow-xs sm:p-6 lg:grid-cols-[280px_1fr] ${danger ? "border-destructive/30" : ""}`}
    >
      <div>
        <h2 className={`font-bold ${danger ? "text-destructive" : ""}`}>{title}</h2>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="max-w-xl min-w-0">{children}</div>
    </section>
  );
}
