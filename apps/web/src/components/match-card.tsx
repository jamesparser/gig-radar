import { ArrowUpRight, Flag, Sparkles } from "lucide-react";
import Link from "next/link";
import type { MatchView } from "@gigradar/api";
import { timeAgo } from "@/lib/format";
import { Badge, ScoreRing, SourceBadge, StatusBadge } from "./ui";

export function MatchCard({ m }: { m: MatchView }) {
  return (
    <Link
      href={`/dashboard/matches/${m.id}`}
      className="group flex gap-4 rounded-[var(--radius-card)] border border-line bg-surface/80 p-4 transition-colors hover:border-line-strong hover:bg-surface-2/80"
    >
      <ScoreRing score={m.score} size={54} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="truncate text-[15px] font-medium tracking-tight text-ink group-hover:text-white">{m.job.title}</h3>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <SourceBadge source={m.job.source} />
          <Badge>{m.job.budgetText}</Badge>
          <Badge tone={m.score >= 80 ? "good" : m.score >= 65 ? "accent" : "neutral"}>{m.label} fit</Badge>
          <StatusBadge status={m.status} />
          {m.draftVersion ? <Badge tone="accent"><Sparkles size={11} /> Draft v{m.draftVersion}</Badge> : null}
          {m.job.postedAt ? <span className="text-[12px] text-faint">· posted {timeAgo(m.job.postedAt)}</span> : null}
        </div>
        <p className="mt-2 line-clamp-2 text-[13.5px] leading-snug text-muted">{m.summary}</p>
        {m.redFlags.length ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-warn"><Flag size={13} className="mt-0.5 shrink-0" />{m.redFlags[0]}</p>
        ) : null}
      </div>
      <ArrowUpRight size={16} className="mt-1 hidden shrink-0 text-faint transition-colors group-hover:text-ink sm:block" />
    </Link>
  );
}
