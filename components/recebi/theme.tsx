"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="recebi-theme">
      {children}
    </NextThemesProvider>
  );
}

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Automático", icon: Monitor },
] as const;

/** Seletor de tema em três botões (claro, escuro, automático). */
export function ThemeSwitcher({ className, compact }: { className?: string; compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  // Só sabemos o tema salvo depois de carregar no navegador.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div role="radiogroup" aria-label="Tema" className={cn("inline-flex rounded-lg border p-0.5", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium opacity-70 transition hover:opacity-100",
              active && "bg-current/10 opacity-100",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {compact ? <span className="sr-only">{label}</span> : label}
          </button>
        );
      })}
    </div>
  );
}

export function useIsDark(): boolean {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark";
}
