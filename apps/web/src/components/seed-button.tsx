"use client";
import { FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Notice } from "./ui";

/** Fixture mode: loads a sample profile (if empty) + 11 fictional listings so the whole loop works with no scraping. */
export function SeedButton({ variant = "secondary", label = "Load sample jobs" }: { variant?: "primary" | "secondary"; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant={variant}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const r = await api("/demo/seed", { method: "POST", body: {} });
            const scored = r.items.filter((i: any) => !i.locked).length;
            const locked = r.items.length - scored;
            setMsg(`Loaded ${r.items.length} fictional listings: ${scored} scored${locked ? `, ${locked} waiting on the Free weekly limit` : ""}.`);
            router.refresh();
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <FlaskConical size={16} /> {busy ? "Loading…" : label}
      </Button>
      {msg ? <Notice tone="neutral">{msg}</Notice> : null}
    </div>
  );
}
