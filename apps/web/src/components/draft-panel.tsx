"use client";
import { CheckSquare, ExternalLink, Lock, RefreshCw, Sparkles, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DraftView } from "@gigradar/api";
import { api } from "@/lib/api";
import { CopyButton } from "./copy-button";
import { Badge, Button, Card, LinkButton, Notice, SectionTitle, buttonClass } from "./ui";

interface Props {
  matchId: string;
  plan: "free" | "pro" | "studio";
  jobUrl: string;
  initialDraft: DraftView | null;
}

export function DraftPanel({ matchId, plan, jobUrl, initialDraft }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftView | null>(initialDraft);
  const [letter, setLetter] = useState(initialDraft?.coverLetter ?? "");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ draft: DraftView }>(`/matches/${matchId}/draft`, { method: "POST", body: {} });
      setDraft(r.draft);
      setLetter(r.draft.coverLetter);
      setChecked(new Set());
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (plan === "free") {
    return (
      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none select-none space-y-3 opacity-40 blur-[3px]" aria-hidden>
          <div className="h-4 w-1/3 rounded bg-white/20" />
          <div className="h-3 w-full rounded bg-white/10" /><div className="h-3 w-11/12 rounded bg-white/10" /><div className="h-3 w-10/12 rounded bg-white/10" /><div className="h-3 w-9/12 rounded bg-white/10" />
          <div className="mt-4 h-4 w-1/4 rounded bg-white/20" />
          <div className="h-10 w-full rounded bg-white/10" /><div className="h-10 w-full rounded bg-white/10" />
        </div>
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-bg/40 to-bg/80 p-6 text-center">
          <div className="max-w-sm">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent"><Lock size={20} /></span>
            <h3 className="mt-3 text-lg font-semibold">Proposal drafts are part of Pro</h3>
            <p className="mt-1.5 text-[13.5px] text-muted">Cover letter, three milestones, questions for the client and a “what you still must do” checklist — for $29/month.</p>
            <LinkButton href="/dashboard/billing" variant="primary" className="mt-4">Upgrade to Pro</LinkButton>
          </div>
        </div>
      </Card>
    );
  }

  if (!draft) {
    return (
      <Card className="grid place-items-center gap-3 p-10 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent"><Sparkles size={20} /></span>
        <h3 className="text-lg font-semibold">Draft a proposal for this gig</h3>
        <p className="max-w-sm text-[13.5px] text-muted">Written from your profile and this listing. You&apos;ll review and edit it, then submit it yourself.</p>
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Button variant="primary" size="lg" onClick={generate} disabled={busy}>{busy ? "Drafting…" : "Generate draft"}</Button>
      </Card>
    );
  }

  const checklistText = draft.youStillMust.map((s) => `[ ] ${s}`).join("\n");
  const milestonesText = draft.milestones.map((m, i) => `${i + 1}. ${m.title} — ${m.percentOfBudget}% (~${m.durationDays} days)\n   ${m.description}`).join("\n");

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle
          title="Cover letter"
          hint="Edit freely — this is your voice, not ours."
          right={<div className="flex items-center gap-2"><Badge>{draft.generatedBy.startsWith("template") ? "Template draft" : "AI draft"} · v{draft.version}</Badge><CopyButton text={letter} label="Copy letter" /></div>}
        />
        <textarea
          aria-label="Cover letter"
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          rows={13}
          className="w-full rounded-lg border border-line-strong bg-bg/70 p-4 text-[14.5px] leading-relaxed text-ink focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        {draft.generatedBy.startsWith("template") ? (
          <Notice tone="warn" className="mt-3">
            {draft.generatedBy === "template-fallback" ? "The AI model was unavailable, so this is the built-in template. " : "No AI model is configured on this deployment, so this is the built-in template. "}
            Replace every [bracketed placeholder] before sending.
          </Notice>
        ) : null}
      </Card>

      <Card className="p-5">
        <SectionTitle title="Milestones" right={<CopyButton text={milestonesText} label="Copy" />} />
        <ol className="divide-y divide-line">
          {draft.milestones.map((m, i) => (
            <li key={i} className="flex gap-3.5 py-3 first:pt-0 last:pb-0">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/10 font-mono text-[12px] text-accent">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium">{m.title}</p>
                <p className="mt-0.5 text-[13.5px] leading-snug text-muted">{m.description}</p>
              </div>
              <div className="shrink-0 text-right text-[13px] tabular-nums text-muted"><span className="font-medium text-ink">{m.percentOfBudget}%</span><br />~{m.durationDays}d</div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Questions to ask the client" right={<CopyButton text={draft.clientQuestions.map((q) => `- ${q}`).join("\n")} label="Copy" />} />
        <ul className="space-y-2">
          {draft.clientQuestions.map((q) => <li key={q} className="flex gap-2.5 text-[14px] leading-snug text-ink"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />{q}</li>)}
        </ul>
      </Card>

      <Card className="border-accent/25 p-5">
        <SectionTitle title="What you still must do" hint={`${checked.size} of ${draft.youStillMust.length} done — GigRadar can't do these for you.`} right={<CopyButton text={checklistText} label="Copy checklist" />} />
        <ul className="space-y-1">
          {draft.youStillMust.map((s, i) => {
            const on = checked.has(i);
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChecked((p) => { const n = new Set(p); on ? n.delete(i) : n.add(i); return n; })}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-[14px] leading-snug hover:bg-white/[.04]"
                >
                  {on ? <CheckSquare size={18} className="mt-px shrink-0 text-accent" /> : <Square size={18} className="mt-px shrink-0 text-faint" />}
                  <span className={on ? "text-muted line-through" : "text-ink"}>{s}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <a href={jobUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "primary", size: "lg" })}>
          <ExternalLink size={16} /> Open listing &amp; submit yourself
        </a>
        <Button variant="secondary" size="lg" onClick={generate} disabled={busy}><RefreshCw size={16} className={busy ? "animate-spin" : ""} /> {busy ? "Redrafting…" : "Redraft"}</Button>
        <p className="text-[12.5px] text-faint">GigRadar never submits for you.</p>
      </div>
      {error ? <Notice tone="bad">{error}</Notice> : null}
    </div>
  );
}
