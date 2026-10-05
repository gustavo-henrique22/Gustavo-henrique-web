import { BASE_PATH } from "@/lib/recebi/config";

/** Avisa o servidor que uma tela quebrou (sem travar a página se falhar). */
export function reportError(error: Error & { digest?: string }) {
  try {
    void fetch(`${BASE_PATH}/api/erros`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: `${error.name}: ${error.message}`.slice(0, 500),
        path: window.location.pathname,
        digest: error.digest ?? "",
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Sem rede: nada a fazer.
  }
}
