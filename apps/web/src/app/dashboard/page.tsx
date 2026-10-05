import { CheckCircle2, Circle, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PLANS } from "@gigradar/core";
import { getProfile, listMatches, lockedJobCount, usageSummary } from "@gigradar/api";
import { MatchCard } from "@/components/match-card";
import { SeedButton } from "@/components/seed-button";
import { Card, LinkButton, Meter, Notice, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Overview" };

export default async function Overview() {
  const { ctx, userId, plan, name } = await requireUser();
  const [usage, profile, matches, locked] = await Promise.all([
    usageSummary(ctx, userId, plan),
    getProfile(ctx, userId),
    listMatches(ctx, userId, { limit: 5 }),
    lockedJobCount(ctx, userId),
  ]);
  const p = PLANS[plan];
  const hasJobs = matches.length > 0 || locked > 0;
  const top = matches[0]?.score ?? null;

  const steps = [
    { done: profile.profile.skills.length > 0, title: "Add your skills", body: "Skills, rate floor and niches drive every score.", href: "/dashboard/profile", cta: "Edit profile" },
    { done: hasJobs, title: "Capture some listings", body: "Install the Chrome extension, or load fictional sample listings to try the loop.", href: "/dashboard/billing#extension", cta: "Extension setup" },
    { done: matches.some((m) => m.draftVersion), title: "Draft a proposal", body: plan === "free" ? "Drafts are part of Pro." : "Open a match and generate the draft.", href: plan === "free" ? "/dashboard/billing" : "/dashboard/matches", cta: plan === "free" ? "See plans" : "Open matches" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hi {name.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-[14px] text-muted">Here&apos;s what your radar picked up.</p>
        </div>
        <SeedButton />
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[12px] uppercase tracking-wider text-faint">Scored this week</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {usage.scoredThisWeek}
            <span className="text-base font-normal text-muted"> / {usage.weeklyLimit ?? "∞"}</span>
          </p>
          <div className="mt-3">{usage.weeklyLimit !== null ? <Meter value={usage.scoredThisWeek} max={usage.weeklyLimit} tone={usage.remaining === 0 ? "warn" : "accent"} /> : <p className="text-[12px] text-muted">Unlimited on {p.name}</p>}</div>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] uppercase tracking-wider text-faint">Best match</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{top ?? "—"}</p>
          <p className="mt-3 text-[12px] text-muted">{matches.length ? "out of 100" : "No scored matches yet"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] uppercase tracking-wider text-faint">Drafts (30 days)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{usage.drafts30d}</p>
          <p className="mt-3 text-[12px] text-muted">{p.proposalDrafts ? "Included in your plan" : "Part of Pro"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] uppercase tracking-wider text-faint">Plan</p>
          <p className="mt-2 text-2xl font-semibold">{p.name}</p>
          <p className="mt-3 text-[12px] text-muted">{p.priceUsdMonthly === 0 ? "Radar only" : `$${p.priceUsdMonthly}/month`}</p>
        </Card>
      </section>

      {locked > 0 ? (
        <Notice tone="warn" className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2"><Lock size={15} /> {locked} captured {locked === 1 ? "listing is" : "listings are"} waiting: your Free plan scores 5 a week.</span>
          <LinkButton href="/dashboard/billing" size="sm" variant="primary">Unlock with Pro — $29</LinkButton>
        </Notice>
      ) : null}

      <section>
        <SectionTitle title="Top matches" right={matches.length ? <Link href="/dashboard/matches" className="text-[13px] text-accent hover:underline">View all</Link> : null} />
        {matches.length ? (
          <div className="space-y-3">{matches.map((m) => <MatchCard key={m.id} m={m} />)}</div>
        ) : (
          <Card className="grid place-items-center gap-3 p-10 text-center">
            <p className="text-[15px] font-medium">Nothing on the radar yet</p>
            <p className="max-w-md text-[13.5px] text-muted">Add your skills, then browse a job board with the extension — or load the fictional sample listings to see the loop end to end.</p>
            <SeedButton variant="primary" label="Load sample jobs" />
          </Card>
        )}
      </section>

      {steps.some((s) => !s.done) ? (
        <section>
          <SectionTitle title="Get set up" />
          <Card className="divide-y divide-line">
            {steps.map((s) => (
              <div key={s.title} className="flex items-center gap-3.5 px-4 py-3.5">
                {s.done ? <CheckCircle2 size={19} className="shrink-0 text-good" /> : <Circle size={19} className="shrink-0 text-faint" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{s.title}</p>
                  <p className="text-[13px] text-muted">{s.body}</p>
                </div>
                {!s.done ? <LinkButton href={s.href} size="sm">{s.cta}</LinkButton> : null}
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
