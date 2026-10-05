"use client";
import { Download, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { Button, Card, Notice, SectionTitle, buttonClass } from "./ui";

export function SettingsPanel({ email }: { email: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle title="Your data" hint="Everything GigRadar holds about you, as one JSON file (no password hashes or license keys)." />
        <a href="/api/account/export" download className={buttonClass({ variant: "secondary" })}><Download size={16} /> Export my data</a>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Session" hint={`Signed in as ${email}`} />
        <Button variant="secondary" onClick={async () => { await authClient.signOut(); router.push("/"); router.refresh(); }}><LogOut size={16} /> Sign out</Button>
      </Card>

      <Card className="border-bad/30 p-5">
        <SectionTitle title="Delete account" hint="Permanently deletes your profile, listings, matches, drafts, digests and license keys, and cancels any Stripe subscription. This can't be undone." />
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder='Type DELETE to confirm'
            aria-label="Type DELETE to confirm"
            className="h-10 w-56 rounded-lg border border-line-strong bg-bg/70 px-3 text-sm placeholder:text-faint focus:border-bad/60 focus:outline-none"
          />
          <Button
            variant="danger"
            disabled={confirm !== "DELETE" || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api("/account", { method: "DELETE", body: { confirm } });
                await authClient.signOut().catch(() => null);
                router.push("/");
                router.refresh();
              } catch (e: any) {
                setError(e.message);
                setBusy(false);
              }
            }}
          >
            <Trash2 size={16} /> {busy ? "Deleting…" : "Delete everything"}
          </Button>
        </div>
        {error ? <Notice tone="bad" className="mt-3">{error}</Notice> : null}
      </Card>
    </div>
  );
}
