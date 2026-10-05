import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { ConfirmIdentityForm } from "@/components/recebi/confirm-identity-form";
import { PasskeyConfirmButton } from "@/components/recebi/passkey-buttons";
import { GOOGLE_ONLY_PASSWORD, requireActor } from "@/lib/recebi/auth";
import { APP_PATH, BASE_PATH } from "@/lib/recebi/config";
import { googleEnabled } from "@/lib/recebi/google";
import { listPasskeys } from "@/lib/recebi/passkeys";
import { REAUTH_MINUTES } from "@/lib/recebi/reauth";

export const metadata: Metadata = { title: "Confirme que é você" };

export default async function ConfirmIdentityPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireActor();
  const requested = (await searchParams).next ?? "";
  const next = requested.startsWith(APP_PATH) && !requested.startsWith("//") ? requested : APP_PATH;
  const hasPassword = user.passwordHash !== GOOGLE_ONLY_PASSWORD;
  const hasTwoFactor = !!user.totpEnabledAt;
  const hasPasskey = (await listPasskeys(user.id)).length > 0;
  const canUseForm = hasPassword || hasTwoFactor;

  return (
    <div className="mx-auto grid max-w-md gap-6 py-6">
      <div className="grid gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#c9ff3c] text-[#101c34]">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">Confirme que é você</h1>
        <p className="text-sm text-muted-foreground">
          Esta área mexe em dados sensíveis. Confirme sua identidade para continuar; vale por {REAUTH_MINUTES} minutos neste aparelho.
        </p>
      </div>
      <div className="grid gap-5 rounded-2xl border bg-card p-5 shadow-xs">
        {canUseForm ? <ConfirmIdentityForm next={next} hasPassword={hasPassword} hasTwoFactor={hasTwoFactor} /> : null}
        {hasPasskey ? <PasskeyConfirmButton next={next} /> : null}
        {!hasPassword && googleEnabled() ? (
          <p className="text-sm text-muted-foreground">
            Sua conta entra pelo Google.{" "}
            <a href={`${BASE_PATH}/api/google`} className="font-semibold text-foreground underline underline-offset-2">
              Entrar de novo com o Google
            </a>{" "}
            também confirma sua identidade.
          </p>
        ) : null}
      </div>
    </div>
  );
}
