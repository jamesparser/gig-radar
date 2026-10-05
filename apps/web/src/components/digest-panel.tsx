"use client";
import { Mail, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { Badge, Button, Card, LinkButton, Notice, SectionTitle } from "./ui";

interface HistoryItem { id: string; subject: string; status: string; createdAt: string; itemCount: number; error: string | null }

export function DigestPanel({ allowed, history, mailerName }: { allowed: boolean; history: HistoryItem[]; mailerName: string }) {
  const router = useRouter();
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "good" | "bad" | "neutral"; text: string } | null>(null);

  if (!allowed) {
    return (
      <Card className="grid place-items-center gap-3 p-10 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent"><Mail size={20} /></span>
        <h3 className="text-lg font-semibold">The email digest is part of Pro</h3>
        <p className="max-w-md text-[13.5px] text-muted">Each morning: your best new matches, a drafted proposal for each, a “what you still must do” checklist, and the link to submit.</p>
        <LinkButton href="/dashboard/billing" variant="primary">Upgrade to Pro — $29</LinkButton>
      </Card>
    );
  }

  async function preview() {
    setBusy("preview");
    setMsg(null);
    try {
      const r = await api<{ subject: string; html: string; itemCount: number; to: string }>("/digest/preview");
      setHtml(r.html);
      setTitle(r.subject);
      if (r.itemCount === 0) setMsg({ tone: "neutral", text: "No matches clear your digest threshold yet. Load listings, or lower the threshold in your profile." });
    } catch (e: any) {
      setMsg({ tone: "bad", text: e.message });
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setBusy("send");
    setMsg(null);
    try {
      const r = await api<any>("/digest/send", { method: "POST", body: {} });
      if (r.status === "skipped") setMsg({ tone: "neutral", text: "Nothing new to send — every eligible match has already been in a digest." });
      else if (r.status === "sent") setMsg({ tone: "good", text: `Sent to ${r.to}: ${r.subject}` });
      else if (r.status === "outbox") setMsg({ tone: "good", text: `No email provider is configured on this deployment, so the digest was saved to your outbox below instead of being emailed (${r.itemCount} matches).` });
      else setMsg({ tone: "bad", text: `Sending failed: ${r.error ?? "unknown error"}. We'll retry on the next run.` });
      router.refresh();
    } catch (e: any) {
      setMsg({ tone: "bad", text: e.message });
    } finally {
      setBusy(null);
    }
  }

  async function open(id: string) {
    setBusy(id);
    try {
      const r = await api<{ html: string; subject: string }>(`/digests/${id}`);
      setHtml(r.html);
      setTitle(r.subject);
    } catch (e: any) {
      setMsg({ tone: "bad", text: e.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={preview} disabled={busy !== null}><Mail size={16} /> {busy === "preview" ? "Composing…" : "Preview next digest"}</Button>
        <Button variant="primary" onClick={send} disabled={busy !== null}><Send size={16} /> {busy === "send" ? "Sending…" : "Send digest now"}</Button>
        <p className="text-[12.5px] text-faint">Delivery: {mailerName === "outbox" ? "outbox only (no email provider configured)" : `via ${mailerName}`} · daily run at 01:00 UTC</p>
      </div>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      {html ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-[13px]"><span className="text-faint">Subject:</span> <span className="font-medium">{title}</span></div>
          {/* sandboxed: the email body contains third-party listing text, so it must never run script in our origin */}
          <iframe title="Digest email preview" sandbox="" srcDoc={html} className="h-[760px] w-full bg-[#0b0d12]" />
        </Card>
      ) : null}

      <section>
        <SectionTitle title="History" hint="Every digest GigRadar composed for you." />
        {history.length ? (
          <Card className="divide-y divide-line">
            {history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Badge tone={h.status === "sent" ? "good" : h.status === "failed" ? "bad" : "neutral"}>{h.status}</Badge>
                <p className="min-w-0 flex-1 truncate text-[13.5px]">{h.subject}</p>
                <span className="text-[12px] text-faint">{h.itemCount} matches · {timeAgo(h.createdAt)}</span>
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => open(h.id)}>View</Button>
              </div>
            ))}
          </Card>
        ) : (
          <p className="text-[13.5px] text-muted">Nothing yet. Preview or send your first digest above, or <Link href="/dashboard/matches" className="text-accent hover:underline">review your matches</Link>.</p>
        )}
      </section>
    </div>
  );
}
