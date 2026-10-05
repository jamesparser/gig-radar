"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Notice } from "./ui";

const OPTIONS: { status: string; label: string }[] = [
  { status: "applied", label: "I submitted it" },
  { status: "won", label: "I won it" },
  { status: "dismissed", label: "Dismiss" },
];

/** Status is set by the human only. GigRadar never changes it based on marketplace activity. */
export function StatusActions({ matchId, status }: { matchId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function set(s: string) {
    setBusy(s);
    setError(null);
    try {
      await api(`/matches/${matchId}`, { method: "PATCH", body: { status: s } });
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] uppercase tracking-wider text-faint">Track</span>
        {OPTIONS.map((o) => (
          <Button key={o.status} size="sm" variant={status === o.status ? "primary" : "secondary"} disabled={busy !== null} onClick={() => set(status === o.status ? "new" : o.status)}>
            {busy === o.status ? "…" : o.label}
          </Button>
        ))}
      </div>
      {error ? <Notice tone="bad" className="mt-2">{error}</Notice> : null}
    </div>
  );
}
