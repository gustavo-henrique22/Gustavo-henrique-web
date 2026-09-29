import { AppSidebar, MobileNav } from "@/components/recebi/app-nav";
import { hasPro, requireUser } from "@/lib/recebi/auth";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const navUser = { name: user.name, email: user.email, isAdmin: user.isAdmin, isPro: hasPro(user) };

  return (
    <div className="flex min-h-dvh">
      <AppSidebar user={navUser} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav user={navUser} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
