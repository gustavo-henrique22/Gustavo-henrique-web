"use client";

import {
  ArrowLeftRight,
  ChartColumn,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "@/lib/recebi/actions/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: APP_PATH, label: "Visão geral", icon: LayoutDashboard },
  { href: `${APP_PATH}/lancamentos`, label: "Lançamentos", icon: ArrowLeftRight },
  { href: `${APP_PATH}/cobrancas`, label: "Cobranças", icon: ReceiptText },
  { href: `${APP_PATH}/clientes`, label: "Clientes", icon: Users },
  { href: `${APP_PATH}/projetos`, label: "Projetos", icon: FolderKanban },
  { href: `${APP_PATH}/relatorios`, label: "Relatórios", icon: ChartColumn },
];

const SECONDARY = [
  { href: `${APP_PATH}/configuracoes`, label: "Configurações", icon: Settings },
  { href: `${APP_PATH}/plano`, label: "Plano", icon: Sparkles },
];

type NavUser = { name: string; email: string; isAdmin: boolean; isPro: boolean };

function NavLinks({ user, onNavigate }: { user: NavUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = [...SECONDARY, ...(user.isAdmin ? [{ href: `${APP_PATH}/admin`, label: "Admin", icon: ShieldCheck }] : [])];

  const link = (item: (typeof NAV)[number]) => {
    const active = item.href === APP_PATH ? pathname === APP_PATH : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        <Icon className={cn("size-4", active && "text-sidebar-primary")} aria-hidden />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <nav aria-label="Principal" className="grid gap-1">
        {NAV.map(link)}
      </nav>
      <div className="my-4 h-px bg-sidebar-border" />
      <nav aria-label="Conta" className="grid gap-1">
        {items.map(link)}
      </nav>
      <div className="mt-auto grid grid-cols-1 gap-3 pt-6">
        {!user.isPro ? (
          <Link
            href={`${APP_PATH}/plano`}
            onClick={onNavigate}
            className="rounded-xl border border-sidebar-border bg-sidebar-accent p-3 text-xs text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"
          >
            <span className="flex items-center gap-1.5 text-sm font-bold text-sidebar-primary">
              <Sparkles className="size-4" aria-hidden /> Seja Pro
            </span>
            Clientes e cobranças ilimitados, relatórios completos.
          </Link>
        ) : null}
        <div className="flex items-center gap-3 rounded-xl px-2 py-1">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            {user.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-sidebar-accent-foreground">{user.name}</span>
            <span className="block truncate text-xs text-sidebar-foreground/60">{user.email}</span>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              title="Sair"
              className="grid size-8 place-items-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="sr-only">Sair</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({ user }: { user: NavUser }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
      <Link href={APP_PATH} className="mb-8 px-2 text-white">
        <Logo />
      </Link>
      <NavLinks user={user} />
    </aside>
  );
}

export function MobileNav({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
      <Link href={APP_PATH}>
        <Logo className="text-base" markClassName="size-6" />
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Abrir menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar px-4 py-5 text-sidebar-foreground" showCloseButton={false}>
          <SheetTitle className="mb-6 px-2 text-white">
            <Logo />
          </SheetTitle>
          <NavLinks user={user} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
