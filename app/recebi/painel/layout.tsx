import { AppSidebar, DesktopTopbar, MobileNav } from "@/components/recebi/app-nav";
import { CommandMenuProvider } from "@/components/recebi/command-menu";
import { DemoBanner } from "@/components/recebi/demo-banner";
import { TeamBanner, TrialBanner } from "@/components/recebi/plan-banners";
import { unreadNotifications } from "@/lib/recebi/activity";
import { hasPro, requireUser } from "@/lib/recebi/auth";
import { listClients, runningTimer } from "@/lib/recebi/data";
import { generateDueRecurring } from "@/lib/recebi/recurring";
import { onTrial, trialDaysLeft } from "@/lib/recebi/trial";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Recorrências vencidas são geradas ao abrir o painel (o cron faz o mesmo para quem não entrou).
  if (hasPro(user)) await generateDueRecurring({ userId: user.id, limit: 10 }).catch((error) => console.error("recorrentes", error));
  const [clients, notices, running] = await Promise.all([listClients(user.id), unreadNotifications(user.id), runningTimer(user.id)]);
  const timer = running ? { startedAt: running.entry.startedAt, label: running.projectName ?? (running.entry.description || null) } : null;
  const bell = { items: notices.items, unread: notices.unread };
  const navUser = {
    name: user.actorName ?? user.name,
    email: user.actorEmail ?? user.email,
    isAdmin: user.isAdmin,
    isPro: hasPro(user),
    isDemo: user.isDemo,
  };

  return (
    <CommandMenuProvider clients={clients.map((c) => ({ id: c.id, name: c.name }))} isAdmin={user.isAdmin}>
      <div className="flex min-h-dvh">
        <AppSidebar user={navUser} />
        <div className="flex min-w-0 flex-1 flex-col">
          {user.isDemo ? <DemoBanner /> : null}
          {user.teamRole ? <TeamBanner ownerName={user.name} readOnly={user.teamRole === "leitura"} /> : null}
          {!user.teamRole && !user.isDemo && onTrial(user) ? <TrialBanner daysLeft={trialDaysLeft(user)} /> : null}
          <MobileNav user={navUser} bell={bell} timer={timer} />
          <DesktopTopbar bell={bell} timer={timer} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
        </div>
      </div>
    </CommandMenuProvider>
  );
}
