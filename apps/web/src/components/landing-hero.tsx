import { FIXTURE_PROFILE, fixtureJobInputs, jobInputSchema, profileSchema, scoreJob } from "@gigradar/core";
import { Badge, ScoreRing } from "./ui";

/** Static illustration built from the *fictional* fixture data, scored by the real scorer. */
export function HeroRadar() {
  const profile = profileSchema.parse(FIXTURE_PROFILE);
  const now = new Date();
  const rows = fixtureJobInputs("https://example.test", now)
    .map((j) => jobInputSchema.parse(j))
    .map((j) => ({ job: j, m: scoreJob(j, profile, now) }))
    .filter((r) => !r.m.disqualified)
    .sort((a, b) => b.m.score - a.m.score)
    .slice(0, 4);

  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      {/* radar rings */}
      <svg className="absolute -inset-10 -z-10 h-[calc(100%+80px)] w-[calc(100%+80px)] text-accent" viewBox="0 0 400 400" fill="none" aria-hidden>
        <g opacity=".5">
          <circle cx="200" cy="200" r="190" stroke="currentColor" strokeOpacity=".12" />
          <circle cx="200" cy="200" r="140" stroke="currentColor" strokeOpacity=".14" />
          <circle cx="200" cy="200" r="90" stroke="currentColor" strokeOpacity=".16" />
          <circle cx="200" cy="200" r="40" stroke="currentColor" strokeOpacity=".2" />
        </g>
        <g className="radar-sweep">
          <path d="M200 200 L200 10 A190 190 0 0 1 335 65 Z" fill="url(#sweep)" />
        </g>
        <defs>
          <linearGradient id="sweep" x1="200" y1="200" x2="300" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="currentColor" stopOpacity="0" />
            <stop offset="1" stopColor="currentColor" stopOpacity=".28" />
          </linearGradient>
        </defs>
      </svg>

      <div className="rounded-2xl border border-line-strong bg-surface/90 shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <span className="relative flex h-2 w-2">
              <span className="blip absolute inline-flex h-full w-full rounded-full bg-accent" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Radar · 4 gigs in range
          </div>
          <Badge>Sample data</Badge>
        </div>
        <ul className="divide-y divide-line">
          {rows.map(({ job, m }) => (
            <li key={job.externalId} className="flex items-start gap-3 px-4 py-3.5">
              <ScoreRing score={m.score} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{job.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted">{m.summary}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[12.5px] text-muted">
          <span>Draft ready: cover letter · 3 milestones · questions</span>
          <span className="rounded-md bg-accent px-2.5 py-1 font-semibold text-accent-ink">You review &amp; send</span>
        </div>
      </div>
    </div>
  );
}
