import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { listMatches, lockedJobCount } from "@gigradar/api";
import { MatchCard } from "@/components/match-card";
import { SeedButton } from "@/components/seed-button";
import { Card, LinkButton, Notice, cn } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Matches" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "strong", label: "Strong (65+)" },
  { key: "drafted", label: "Drafted" },
  { key: "applied", label: "Applied" },
  { key: "won", label: "Won" },
  { key: "dismissed", label: "Dismissed" },
];

export default async function Matches({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter = "all" } = await searchParams;
  const { ctx, userId } = await requireUser();
  const matches = await listMatches(ctx, userId, {
    limit: 100,
    ...(filter === "strong" ? { minScore: 65 } : {}),
    ...(["drafted", "applied", "won", "dismissed"].includes(filter) ? { status: filter } : {}),
  });
  const locked = await lockedJobCount(ctx, userId);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
          <p className="mt-1 text-[14px] text-muted">Every scored listing, best fit first.</p>
        </div>
        <SeedButton />
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Filter matches">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/dashboard/matches" : `/dashboard/matches?filter=${f.key}`}
            role="tab"
            aria-selected={filter === f.key}
            className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-[13px]", filter === f.key ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-muted hover:text-ink")}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {locked > 0 ? (
        <Notice tone="warn" className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2"><Lock size={15} /> {locked} more {locked === 1 ? "listing is" : "listings are"} captured but unscored (Free: 5 a week).</span>
          <LinkButton href="/dashboard/billing" size="sm" variant="primary">Score them all</LinkButton>
        </Notice>
      ) : null}

      {matches.length ? (
        <div className="space-y-3">{matches.map((m) => <MatchCard key={m.id} m={m} />)}</div>
      ) : (
        <Card className="p-10 text-center text-[14px] text-muted">No matches here yet.</Card>
      )}
    </div>
  );
}
