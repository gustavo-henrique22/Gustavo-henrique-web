"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markNotificationsRead } from "@/lib/recebi/actions/notifications";
import { formatRelative } from "@/lib/recebi/dates";
import { cn } from "@/lib/utils";

export type BellItem = { id: string; title: string; body: string; href: string; readAt: string | null; createdAt: string };

/** Sininho com os avisos: orçamento visto/aprovado, pedidos da página pública, pagamentos… */
export function NotificationBell({ items, unread }: { items: BellItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const markRead = () => startTransition(async () => void (await markNotificationsRead()));

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        // Ao fechar depois de ver, marca tudo como lido.
        if (!value && unread > 0) markRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread > 0 ? `${unread} avisos novos` : "Avisos"} className="relative">
          <Bell />
          {unread > 0 ? (
            <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.6rem] leading-4 font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-bold">Avisos</p>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markRead}
              disabled={pending}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" /> Marcar como lidos
            </button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum aviso por enquanto.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href || "#"}
                  onClick={() => setOpen(false)}
                  className={cn("flex gap-3 px-4 py-3 text-sm hover:bg-muted/60", !item.readAt && "bg-[#c9ff3c]/10")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.readAt ? "bg-transparent" : "bg-destructive")} />
                  <span className="min-w-0">
                    <span className="block font-medium">{item.title}</span>
                    {item.body ? <span className="block text-xs text-muted-foreground">{item.body}</span> : null}
                    <span className="block text-xs text-muted-foreground" suppressHydrationWarning>
                      {formatRelative(item.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
