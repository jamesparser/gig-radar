import type { Metadata } from "next";
import Link from "next/link";
import { FIXTURE_JOBS } from "@gigradar/core";
import { BoardShell, JobFacts } from "@/components/fixture-board";

export const metadata: Metadata = { title: "Fixture job board", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function DemoBoard() {
  const now = Date.now();
  return (
    <BoardShell>
      <h1 className="text-2xl font-semibold tracking-tight">Find work — fixture board</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">{FIXTURE_JOBS.length} fictional listings. Open the GigRadar extension and press <b className="text-ink">Scan this page</b>.</p>
      <div className="space-y-4">
        {FIXTURE_JOBS.map((job) => (
          <article key={job.id} data-gr-job="" data-gr-id={job.id} className="rounded-xl border border-line bg-surface/70 p-5">
            <h2 className="text-[17px] font-semibold tracking-tight">
              <Link data-gr-title="" href={`/demo-board/jobs/${job.id}`} className="hover:text-accent">{job.title}</Link>
            </h2>
            <p data-gr-description="" className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-muted">{job.description?.slice(0, 220)}…</p>
            <div className="mt-3"><JobFacts job={job} now={now} /></div>
          </article>
        ))}
      </div>
    </BoardShell>
  );
}
