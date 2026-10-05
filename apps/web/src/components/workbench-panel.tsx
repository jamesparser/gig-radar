"use client";
import { Hammer, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MatchDetail } from "@gigradar/api";
import { api } from "@/lib/api";
import { CopyButton } from "./copy-button";
import { Badge, Button, Card, LinkButton, Notice, SectionTitle } from "./ui";

export function WorkbenchPanel({ matchId, plan, status, items }: { matchId: string; plan: "free" | "pro" | "studio"; status: string; items: MatchDetail["workbench"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function make(kind: "kickoff" | "deliverable") {
    setBusy(kind);
    setError(null);
    try {
      await api(`/matches/${matchId}/workbench`, { method: "POST", body: { kind } });
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (plan !== "studio") {
    return (
      <Card className="flex items-center gap-4 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/5 text-faint"><Lock size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-medium">Work bench <Badge className="ml-1">Studio</Badge></p>
          <p className="text-[13px] text-muted">After you win a gig: kickoff plan, client message and first-deliverable outline.</p>
        </div>
        <LinkButton href="/dashboard/billing" size="sm">See Studio</LinkButton>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <SectionTitle title="Work bench" hint="Post-win documents. Drafts for you to review — nothing is sent to the client." />
      {status !== "won" ? (
        <Notice>Mark this gig as won (“I won it” above) to draft your kickoff plan and first deliverable.</Notice>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy !== null} onClick={() => make("kickoff")}><Hammer size={15} /> {busy === "kickoff" ? "Drafting…" : "Kickoff plan + client message"}</Button>
          <Button variant="secondary" disabled={busy !== null} onClick={() => make("deliverable")}><Hammer size={15} /> {busy === "deliverable" ? "Drafting…" : "First deliverable outline"}</Button>
        </div>
      )}
      {error ? <Notice tone="bad" className="mt-3">{error}</Notice> : null}
      <div className="mt-4 space-y-4">
        {items.map((w) => (
          <div key={w.id} className="rounded-lg border border-line bg-bg/50 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[14px] font-medium">{w.title}</p>
              <div className="flex items-center gap-2"><Badge>{w.generatedBy.startsWith("template") ? "Template" : "AI"}</Badge><CopyButton text={w.content} /></div>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-muted">{w.content}</pre>
          </div>
        ))}
      </div>
    </Card>
  );
}
