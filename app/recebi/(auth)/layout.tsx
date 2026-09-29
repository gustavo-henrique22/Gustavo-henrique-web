import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/recebi/logo";
import { getCurrentUser } from "@/lib/recebi/auth";
import { APP_PATH, BASE_PATH } from "@/lib/recebi/config";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect(APP_PATH);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link href={BASE_PATH} className="w-fit">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Recebi · Feito no Brasil para freelancers</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-[#101c34] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:48px_48px]"
        />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c9ff3c]">Para freelancers e MEIs</p>
          <h2 className="mt-5 max-w-md text-4xl font-extrabold leading-[1.05] tracking-tight">
            Saiba quanto você <span className="text-[#c9ff3c]">realmente</span> ganha todo mês.
          </h2>
        </div>
        <div className="relative grid gap-3">
          <PreviewRow label="Site institucional · Padaria Sol" value="+ R$ 2.400,00" tone="in" />
          <PreviewRow label="Adobe Creative Cloud" value="− R$ 124,00" tone="out" />
          <PreviewRow label="Cobrança #0012 · paga via Pix" value="+ R$ 850,00" tone="in" />
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs text-white/60">Lucro em setembro</p>
            <p className="mt-1 text-3xl font-extrabold tabular">R$ 6.912,40</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[78%] rounded-full bg-[#c9ff3c]" />
            </div>
            <p className="mt-2 text-xs text-white/60">78% da meta mensal</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function PreviewRow({ label, value, tone }: { label: string; value: string; tone: "in" | "out" }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
      <span className="text-white/80">{label}</span>
      <span className={`font-bold tabular ${tone === "in" ? "text-[#c9ff3c]" : "text-[#ff8a70]"}`}>{value}</span>
    </div>
  );
}
