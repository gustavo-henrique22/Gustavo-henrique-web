"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_PATH } from "@/lib/recebi/config";
import { cn } from "@/lib/utils";

const TABS = [
  { href: `${APP_PATH}/configuracoes`, label: "Geral" },
  { href: `${APP_PATH}/configuracoes/seguranca`, label: "Segurança" },
  { href: `${APP_PATH}/configuracoes/nota-fiscal`, label: "Nota fiscal" },
  { href: `${APP_PATH}/configuracoes/privacidade`, label: "Privacidade" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções das configurações" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-max rounded-xl border bg-card p-1 text-sm shadow-xs">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg px-4 py-1.5 font-medium text-muted-foreground transition hover:text-foreground",
                active && "bg-primary text-primary-foreground hover:text-primary-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
