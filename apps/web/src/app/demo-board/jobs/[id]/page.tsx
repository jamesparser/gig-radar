import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardShell, JobFacts, fixtureById } from "@/components/fixture-board";
import { FixtureProposalForm } from "@/components/fixture-proposal-form";

export const metadata: Metadata = { title: "Fixture listing", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FixtureJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = fixtureById(id);
  if (!job) notFound();
  return (
    <BoardShell>
      <Link href="/demo-board" className="text-[13px] text-muted hover:text-ink">← All listings</Link>
      <article data-gr-job="" data-gr-detail="" data-gr-id={job.id} className="mt-4 rounded-xl border border-line bg-surface/70 p-6">
        <h1 data-gr-title="" className="text-2xl font-semibold tracking-tight">{job.title}</h1>
        <div className="mt-3"><JobFacts job={job} now={Date.now()} /></div>
        <p data-gr-description="" className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-muted">{job.description}</p>
      </article>
      <FixtureProposalForm />
    </BoardShell>
  );
}
