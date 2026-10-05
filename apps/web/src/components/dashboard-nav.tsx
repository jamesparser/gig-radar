"use client";
import { CreditCard, LayoutDashboard, ListChecks, LogOut, Mail, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "./ui";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/matches", label: "Matches", icon: ListChecks },
  { href: "/dashboard/profile", label: "Skills profile", icon: UserRound },
  { href: "/dashboard/digest", label: "Digest", icon: Mail },
  { href: "/dashboard/billing", label: "Plan & license", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Dashboard">
      {ITEMS.map((it) => {
        const active = it.exact ? path === it.href : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] transition-colors",
              active ? "bg-white/[.07] text-ink" : "text-muted hover:bg-white/5 hover:text-ink",
            )}
          >
            <it.icon size={17} className={active ? "text-accent" : ""} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13.5px] text-muted hover:bg-white/5 hover:text-ink"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut size={16} /> Sign out
    </button>
  );
}
