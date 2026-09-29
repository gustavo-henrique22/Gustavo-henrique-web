"use client";

import { LogOut, Menu, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "@/lib/recebi/actions/auth";
import { APP_PATH } from "@/lib/recebi/config";
import { cn } from "@/lib/utils";
import { useOpenCommandMenu } from "./command-menu";
import { Logo } from "./logo";
import { NotificationBell } from "./notification-bell";
import { ACCOUNT_NAV, ADMIN_NAV, MAIN_NAV } from "./nav-items";
import { InstallAppButton } from "./pwa";
import { ThemeSwitcher } from "./theme";
import { RunningTimerPill } from "./timer";

type NavUser = { name: string; email: string; isAdmin: boolean; isPro: boolean; isDemo: boolean };

function NavLinks({ user, onNavigate }: { user: NavUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  const account = [...ACCOUNT_NAV, ...(user.isAdmin ? [ADMIN_NAV] : [])];

  const link = (item: (typeof MAIN_NAV)[number]) => {
    const active = item.href === APP_PATH ? pathname === APP_PATH : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        {active ? <span aria-hidden className="absolute top-2 bottom-2 -left-4 w-1 rounded-r-full bg-sidebar-primary" /> : null}
        <Icon
          className={cn("size-4 transition-colors", active ? "text-sidebar-primary" : "group-hover:text-sidebar-accent-foreground")}
          aria-hidden
        />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <nav aria-label="Principal" className="grid gap-0.5">
        {MAIN_NAV.map(link)}
      </nav>
      <div className="my-4 h-px bg-sidebar-border" />
      <nav aria-label="Conta" className="grid gap-0.5">
        {account.map(link)}
      </nav>
      <div className="mt-auto grid grid-cols-1 gap-3 pt-6">
        {!user.isPro ? (
          <Link
            href={`${APP_PATH}/plano`}
            onClick={onNavigate}
            className="relative overflow-hidden rounded-xl border border-sidebar-border bg-gradient-to-br from-sidebar-primary/15 to-transparent p-3 text-xs text-sidebar-foreground/80 transition hover:border-sidebar-primary/40 hover:text-sidebar-accent-foreground"
          >
            <span className="flex items-center gap-1.5 text-sm font-bold text-sidebar-primary">
              <Sparkles className="size-4" aria-hidden /> Seja Pro
            </span>
            Tudo ilimitado, lembretes automáticos e sua logo nas cobranças.
          </Link>
        ) : null}
        <InstallAppButton
          variant="ghost"
          className="justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        />
        <ThemeSwitcher compact className="w-fit border-sidebar-border text-sidebar-foreground" />
        <div className="flex items-center gap-3 rounded-xl px-1 py-1">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            {user.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-sidebar-accent-foreground">
              <span className="truncate">{user.name}</span>
              {user.isPro ? (
                <span className="rounded bg-sidebar-primary px-1 text-[0.6rem] font-extrabold text-sidebar-primary-foreground">PRO</span>
              ) : null}
            </span>
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
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
      <Link href={APP_PATH} className="mb-8 px-2 text-white">
        <Logo />
      </Link>
      <NavLinks user={user} />
    </aside>
  );
}

function SearchButton({ className }: { className?: string }) {
  const open = useOpenCommandMenu();
  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-xs transition hover:border-foreground/20 hover:text-foreground",
        className,
      )}
    >
      <Search className="size-4" aria-hidden />
      <span className="flex-1 text-left">Buscar ou ir para…</span>
      <Kbd className="hidden sm:inline-flex">Ctrl K</Kbd>
    </button>
  );
}

/** Barra superior do painel no computador: busca rápida e avisos. */
type TimerInfo = { startedAt: string; label: string | null } | null;

export function DesktopTopbar({ bell, timer }: { bell: React.ComponentProps<typeof NotificationBell>; timer: TimerInfo }) {
  return (
    <div className="sticky top-0 z-20 hidden border-b bg-background/80 backdrop-blur lg:block">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-end gap-2 px-10">
        {timer ? <RunningTimerPill startedAt={timer.startedAt} label={timer.label} /> : null}
        <SearchButton className="w-72" />
        <NotificationBell {...bell} />
      </div>
    </div>
  );
}

export function MobileNav({ user, bell, timer }: { user: NavUser; bell: React.ComponentProps<typeof NotificationBell>; timer: TimerInfo }) {
  const [open, setOpen] = useState(false);
  const openSearch = useOpenCommandMenu();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
      <Link href={APP_PATH}>
        <Logo className="text-base" markClassName="size-6" />
      </Link>
      <div className="flex items-center gap-1">
        {timer ? <RunningTimerPill startedAt={timer.startedAt} label={null} /> : null}
        <Button variant="ghost" size="icon" aria-label="Buscar" onClick={openSearch}>
          <Search />
        </Button>
        <NotificationBell {...bell} />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 overflow-y-auto border-0 bg-sidebar px-4 py-5 text-sidebar-foreground"
            showCloseButton={false}
          >
            <SheetTitle className="mb-6 px-2 text-white">
              <Logo />
            </SheetTitle>
            <NavLinks user={user} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
