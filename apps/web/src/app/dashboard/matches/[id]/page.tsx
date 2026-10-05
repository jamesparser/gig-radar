import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, getMatchDetail } from "@gigradar/api";
import { DraftPanel } from "@/components/draft-panel";
import { StatusActions } from "@/components/status-actions";
import { WorkbenchPanel } from "@/components/workbench-panel";
import { Badge, Card, ScoreRing, SectionTitle, SourceBadge, StatusBadge, buttonClass } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Match" };

interface Factor { key: string; label: string; points: number; max: number; note: string }

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, userId, plan } = await requireUser();
  let m;
  try {
    m = await getMatchDetail(ctx, userId, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const factors = m.factors as Factor[];
  const c = m.job.client;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/matches" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} /> All matches</Link>

      <header className="flex flex-wrap items-start gap-5">
        <div className="order-1"><ScoreRing score={m.score} size={76} /></div>
        <div className="order-3 min-w-0 basis-full sm:order-2 sm:basis-0 sm:flex-1">
          <h1 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{m.job.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SourceBadge source={m.job.source} />
            <Badge>{m.job.budgetText}</Badge>
            <Badge tone={m.score >= 80 ? "good" : m.score >= 65 ? "accent" : "neutral"}>{m.label} fit</Badge>
            <StatusBadge status={m.status} />
            {m.job.postedAt ? <span className="text-[12.5px] text-faint">· posted {timeAgo(m.job.postedAt)}</span> : null}
          </div>
          <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-muted">{m.summary}</p>
        </div>
        <a href={m.job.url} target="_blank" rel="noopener noreferrer" className={`${buttonClass({ variant: "secondary" })} order-2 ml-auto sm:order-3 sm:ml-0`}><ExternalLink size={15} /> View listing</a>
      </header>

      <StatusActions matchId={m.id} status={m.status} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle title="Why this score" hint={`Scorer ${"fit-v1"} · deterministic, every point explained`} />
            <ul className="space-y-4">
              {factors.map((f) => (
                <li key={f.key}>
                  <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="font-medium">{f.label}</span>
                    <span className="tabular-nums text-muted">{f.points} / {f.max}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-accent" style={{ width: `${(f.points / f.max) * 100}%` }} /></div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-muted">{f.note}</p>
                </li>
              ))}
            </ul>
            {m.redFlags.length ? (
              <div className="mt-5 rounded-lg border border-warn/30 bg-warn/[.07] p-3">
                <p className="text-[12px] font-medium uppercase tracking-wider text-warn">Red flags</p>
                <ul className="mt-1.5 space-y-1 text-[13px] text-warn">{m.redFlags.map((r) => <li key={r}>• {r}</li>)}</ul>
              </div>
            ) : null}
            {m.missingSkills.length ? (
              <p className="mt-4 text-[12.5px] text-muted">The listing also wants: {m.missingSkills.join(", ")} — not in your profile.</p>
            ) : null}
          </Card>

          <Card className="p-5">
            <SectionTitle title="The listing" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <div><dt className="text-faint">Budget</dt><dd className="mt-0.5 text-ink">{m.job.budgetText}</dd></div>
              <div><dt className="text-faint">Client country</dt><dd className="mt-0.5 text-ink">{c.country ?? "—"}</dd></div>
              <div><dt className="text-faint">Payment</dt><dd className="mt-0.5 text-ink">{c.paymentVerified === undefined ? "—" : c.paymentVerified ? "Verified" : "Not verified"}</dd></div>
              <div><dt className="text-faint">Rating</dt><dd className="mt-0.5 text-ink">{c.rating !== undefined ? `${c.rating.toFixed(1)} ★` : "—"}</dd></div>
              <div><dt className="text-faint">Total spent</dt><dd className="mt-0.5 text-ink">{c.totalSpent !== undefined ? `$${c.totalSpent.toLocaleString("en-US")}` : "—"}</dd></div>
              <div><dt className="text-faint">Proposals so far</dt><dd className="mt-0.5 text-ink">{c.proposals ?? "—"}</dd></div>
            </dl>
            {m.job.skills.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {m.job.skills.map((s) => <Badge key={s} tone={m.matchedSkills.some((x) => x.toLowerCase() === s.toLowerCase() || s.toLowerCase().includes(x.toLowerCase())) ? "accent" : "neutral"}>{s}</Badge>)}
              </div>
            ) : null}
            <p className="mt-4 whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted">{m.description || "No description was captured."}</p>
          </Card>
        </div>

        <div className="space-y-5">
          <DraftPanel matchId={m.id} plan={plan} jobUrl={m.job.url} initialDraft={m.draft} />
          <WorkbenchPanel matchId={m.id} plan={plan} status={m.status} items={m.workbench} />
        </div>
      </div>
    </div>
  );
}
