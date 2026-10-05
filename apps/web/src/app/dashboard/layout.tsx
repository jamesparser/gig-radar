import Link from "next/link";
import { DashboardNav, SignOutButton } from "@/components/dashboard-nav";
import { Logo, PlanBadge } from "@/components/ui";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="mx-auto grid min-h-dvh max-w-[1280px] grid-cols-1 gap-0 lg:grid-cols-[236px_1fr]">
      <aside className="min-w-0 border-b border-line px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r lg:py-6">
        <div className="flex items-center justify-between lg:block">
          <Link href="/dashboard" aria-label="Dashboard home"><Logo /></Link>
          <div className="flex items-center gap-1 lg:block">
            <div className="lg:mt-6 lg:mb-5 lg:rounded-xl lg:border lg:border-line lg:bg-surface/70 lg:p-3">
              <p className="hidden truncate text-[13px] font-medium text-ink lg:block">{user.name}</p>
              <p className="hidden truncate text-[12px] text-muted lg:block">{user.email}</p>
              <div className="lg:mt-2"><PlanBadge plan={user.plan} /></div>
            </div>
            <div className="lg:hidden"><SignOutButton /></div>
          </div>
        </div>
        <div className="mt-3 lg:mt-0"><DashboardNav /></div>
        <div className="mt-2 hidden lg:absolute lg:bottom-5 lg:block"><SignOutButton /></div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-9">{children}</main>
    </div>
  );
}
