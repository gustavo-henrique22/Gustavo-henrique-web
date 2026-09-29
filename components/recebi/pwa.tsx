"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registra o service worker (página offline) do Recebi. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/recebi/sw.js", { scope: "/recebi/" }).catch(() => {});
  }, []);
  return null;
}

function subscribeDisplayMode(callback: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Botão "Instalar app": usa o prompt do navegador ou mostra o passo a passo do iPhone. */
export function InstallAppButton({ className, variant = "outline" }: { className?: string; variant?: "outline" | "ghost" | "default" }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone, () => true);
  const ios = useSyncExternalStore(
    () => () => {},
    () => /iphone|ipad|ipod/i.test(navigator.userAgent),
    () => false,
  );
  const installed = standalone || justInstalled;

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setJustInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={className}
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(null);
          } else {
            setHelp(true);
          }
        }}
      >
        <Download /> Instalar app
      </Button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instalar o Recebi no iPhone</DialogTitle>
            <DialogDescription>Em dois toques o Recebi vira um app na sua tela inicial.</DialogDescription>
          </DialogHeader>
          <ol className="grid gap-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-muted">
                <Share className="size-4" />
              </span>
              No Safari, toque em <strong>Compartilhar</strong>.
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-muted">
                <SquarePlus className="size-4" />
              </span>
              Escolha <strong>Adicionar à Tela de Início</strong>.
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
