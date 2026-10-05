import Link from "next/link";
import { FIXTURE_JOBS, formatBudget, type FixtureJob } from "@gigradar/core";
import { Badge } from "./ui";

/**
 * The fixture marketplace. Listings are FICTIONAL. The markup follows the documented `data-gr-*` fixture schema
 * (packages/extension/src/parsers/fixture.ts) so the Chrome extension can be demoed end to end without scraping a real site.
 */

export function postedLabel(minutes: number) {
  if (minutes < 60) return `${minutes} minutes ago`;
  if (minutes < 60 * 48) return `${Math.round(minutes / 60)} hours ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

export function BoardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-5 py-8" data-gr-board="fixture">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn/[.07] px-4 py-3 text-[13px] text-warn">
        <span><b>Fixture board</b> — fictional listings for the GigRadar demo. Not a real marketplace; nothing here is submitted anywhere.</span>
        <Link href="/dashboard" className="underline-offset-2 hover:underline">Back to GigRadar</Link>
      </div>
      {children}
    </div>
  );
}

export function JobFacts({ job, now }: { job: FixtureJob; now: number }) {
  const b = { type: job.budget?.type ?? "unknown", min: job.budget?.min, max: job.budget?.max, currency: job.budget?.currency ?? "USD" } as const;
  const c = job.client ?? {};
  const postedIso = new Date(now - job.postedMinutesAgo * 60_000).toISOString();
  return (
    <>
      <p
        data-gr-budget=""
        data-gr-budget-type={b.type}
        data-gr-budget-min={b.min}
        data-gr-budget-max={b.max}
        data-gr-currency={b.currency}
        className="text-[14px] font-medium text-ink"
      >
        {formatBudget({ ...b, currency: b.currency })}
      </p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {(job.skills ?? []).map((s) => (
          <li key={s} data-gr-skill=""><Badge>{s}</Badge></li>
        ))}
      </ul>
      <div
        data-gr-client=""
        data-gr-payment-verified={c.paymentVerified === undefined ? undefined : String(c.paymentVerified)}
        data-gr-rating={c.rating}
        data-gr-spent={c.totalSpent}
        data-gr-hire-rate={c.hireRate}
        data-gr-proposals={c.proposals}
        data-gr-country={c.country}
        className="mt-3 text-[12.5px] text-muted"
      >
        {c.paymentVerified ? "Payment verified" : "Payment not verified"}
        {c.rating !== undefined ? ` · ${c.rating.toFixed(1)}★` : ""}
        {c.totalSpent !== undefined ? ` · $${c.totalSpent.toLocaleString("en-US")} spent` : ""}
        {c.country ? ` · ${c.country}` : ""}
        {c.proposals !== undefined ? ` · ${c.proposals} proposals` : ""}
      </div>
      <time data-gr-posted="" dateTime={postedIso} className="mt-1 block text-[12px] text-faint">Posted {postedLabel(job.postedMinutesAgo)}</time>
    </>
  );
}

export function fixtureById(id: string) {
  return FIXTURE_JOBS.find((j) => j.id === id);
}
