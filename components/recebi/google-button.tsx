import { googleEnabled } from "@/lib/recebi/google";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 2.8 14.7 1.8 12 1.8 6.5 1.8 2 6.3 2 11.8s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.8H12z"
      />
    </svg>
  );
}

/** Botão "Entrar com Google" (só aparece quando o login com Google está configurado). */
export function GoogleButton({ label = "Entrar com Google" }: { label?: string }) {
  if (!googleEnabled()) return null;
  return (
    <>
      {/* Navegação completa (não usar next/link): o fluxo do Google precisa de redirecionamentos de página inteira. */}
      <a
        href="/recebi/api/google"
        className="flex h-10 w-full items-center justify-center gap-3 rounded-md border bg-card text-sm font-semibold shadow-xs transition hover:bg-muted"
      >
        <GoogleIcon /> {label}
      </a>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou com e-mail <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
