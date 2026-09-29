"use client";

import { FilePlus2, FileSignature, FileUp, Minus, Monitor, Moon, Plus, Search, Sun, Timer, User, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { APP_PATH } from "@/lib/recebi/config";
import { ACCOUNT_NAV, ADMIN_NAV, MAIN_NAV } from "./nav-items";

const CommandMenuContext = createContext<() => void>(() => {});

/** Abre a busca rápida de qualquer lugar do painel. */
export function useOpenCommandMenu() {
  return useContext(CommandMenuContext);
}

export function CommandMenuProvider({
  clients,
  isAdmin,
  children,
}: {
  clients: { id: string; name: string }[];
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  const pages = [...MAIN_NAV, ...ACCOUNT_NAV, ...(isAdmin ? [ADMIN_NAV] : [])];

  return (
    <CommandMenuContext.Provider value={() => setOpen(true)}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Busca rápida"
        description="Vá para uma página ou crie algo novo"
        showCloseButton={false}
      >
        <CommandInput placeholder="Buscar páginas, clientes ou ações…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          <CommandGroup heading="Criar">
            <CommandItem onSelect={() => go(`${APP_PATH}/lancamentos?novo=receita`)}>
              <Plus /> Nova receita
            </CommandItem>
            <CommandItem onSelect={() => go(`${APP_PATH}/lancamentos?novo=despesa`)}>
              <Minus /> Nova despesa
            </CommandItem>
            <CommandItem onSelect={() => go(`${APP_PATH}/orcamentos/novo`)}>
              <FileSignature /> Novo orçamento
            </CommandItem>
            <CommandItem onSelect={() => go(`${APP_PATH}/cobrancas/nova`)}>
              <FilePlus2 /> Nova cobrança
            </CommandItem>
            <CommandItem onSelect={() => go(`${APP_PATH}/cobrancas?novo=rapida`)}>
              <Zap /> Cobrança rápida (link de Pix)
            </CommandItem>
            <CommandItem onSelect={() => go(`${APP_PATH}/horas`)}>
              <Timer /> Iniciar cronômetro
            </CommandItem>
            <CommandItem onSelect={() => go(`${APP_PATH}/lancamentos/importar`)}>
              <FileUp /> Importar extrato do banco
            </CommandItem>
          </CommandGroup>
          {query.trim().length > 1 ? (
            <CommandGroup heading="Lançamentos">
              <CommandItem value={`buscar ${query}`} onSelect={() => go(`${APP_PATH}/lancamentos?q=${encodeURIComponent(query.trim())}`)}>
                <Search /> Buscar “{query.trim()}” nos lançamentos do mês
              </CommandItem>
            </CommandGroup>
          ) : null}
          <CommandSeparator />
          <CommandGroup heading="Ir para">
            {pages.map(({ href, label, icon: Icon }) => (
              <CommandItem key={href} onSelect={() => go(href)}>
                <Icon /> {label}
              </CommandItem>
            ))}
          </CommandGroup>
          {clients.length > 0 ? (
            <CommandGroup heading="Clientes">
              {clients.map((client) => (
                <CommandItem key={client.id} value={`cliente ${client.name}`} onSelect={() => go(`${APP_PATH}/clientes/${client.id}`)}>
                  <User /> {client.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          <CommandSeparator />
          <CommandGroup heading="Aparência">
            <CommandItem onSelect={() => (setTheme("light"), setOpen(false))}>
              <Sun /> Tema claro
            </CommandItem>
            <CommandItem onSelect={() => (setTheme("dark"), setOpen(false))}>
              <Moon /> Tema escuro
            </CommandItem>
            <CommandItem onSelect={() => (setTheme("system"), setOpen(false))}>
              <Monitor /> Tema automático
              <CommandShortcut>sistema</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandMenuContext.Provider>
  );
}
