"use client";
import { Eye, EyeOff, KeyRound, Plus, RotateCw, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { LicenseView } from "@gigradar/api";
import { api } from "@/lib/api";
import { CopyButton } from "./copy-button";
import { Badge, Button, Card, Notice, SectionTitle } from "./ui";

export function UpgradeButton({ plan, label, primary }: { plan: "pro" | "studio"; label: string; primary?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant={primary ? "primary" : "secondary"}
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const r = await api<{ url: string }>("/billing/checkout", { method: "POST", body: { plan } });
            window.location.href = r.url;
          } catch (e: any) {
            setError(e.message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening Stripe…" : label}
      </Button>
      {error ? <Notice tone="bad">{error}</Notice> : null}
    </div>
  );
}

export function ManageBillingButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const r = await api<{ url: string }>("/billing/portal", { method: "POST", body: {} });
            window.location.href = r.url;
          } catch (e: any) {
            setError(e.message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening…" : "Manage billing"}
      </Button>
      {error ? <Notice tone="bad">{error}</Notice> : null}
    </div>
  );
}

/** Stripe redirects back with ?checkout=success&session_id=… — fulfil immediately so activation never waits on the webhook. */
export function CheckoutReturn() {
  const sp = useSearchParams();
  const router = useRouter();
  const status = sp.get("checkout");
  const sessionId = sp.get("session_id");
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (status !== "success" || !sessionId) return;
    let cancelled = false;
    setState("working");
    api<{ plan: string }>("/billing/confirm", { method: "POST", body: { sessionId } })
      .then((r) => {
        if (cancelled) return;
        setState("done");
        setMsg(`You're on ${r.plan === "studio" ? "Studio" : "Pro"}. Your license key is below — paste it into the extension.`);
        router.replace("/dashboard/billing");
        router.refresh();
      })
      .catch((e) => {
        if (cancelled) return;
        setState("error");
        setMsg(`${e.message} If you were charged, your plan will activate as soon as Stripe's webhook arrives — refresh in a moment.`);
      });
    return () => {
      cancelled = true;
    };
  }, [status, sessionId, router]);

  if (status === "cancelled") return <Notice tone="neutral">Checkout cancelled — you haven&apos;t been charged.</Notice>;
  if (state === "working") return <Notice tone="neutral">Activating your plan…</Notice>;
  if (state === "done") return <Notice tone="good">{msg}</Notice>;
  if (state === "error") return <Notice tone="warn">{msg}</Notice>;
  return null;
}

export function DevUpgrade({ current }: { current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <Notice tone="warn" className="flex flex-wrap items-center gap-2">
      <span className="font-medium">Dev only:</span> simulate a plan without Stripe (disabled in production).
      {(["free", "pro", "studio"] as const).map((p) => (
        <Button
          key={p}
          size="sm"
          variant={current === p ? "primary" : "secondary"}
          disabled={busy !== null}
          onClick={async () => {
            setBusy(p);
            await api("/billing/dev-upgrade", { method: "POST", body: { plan: p } }).catch(() => null);
            await api("/matches/rescore", { method: "POST", body: {} }).catch(() => null);
            setBusy(null);
            router.refresh();
          }}
        >
          {p}
        </Button>
      ))}
    </Notice>
  );
}

export function LicenseManager({ initial, seats, appUrl }: { initial: LicenseView[]; seats: number; appUrl: string }) {
  const router = useRouter();
  const [licenses, setLicenses] = useState(initial);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = licenses.filter((l) => !l.revoked);

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }
  const reveal = (id: string) =>
    run(id, async () => {
      if (!keys[id]) {
        const r = await api<{ key: string }>(`/license/${id}/reveal`, { method: "POST", body: {} });
        setKeys((k) => ({ ...k, [id]: r.key }));
      }
      setShown((s) => ({ ...s, [id]: !s[id] }));
    });

  return (
    <Card className="p-5">
      <SectionTitle
        title="License keys"
        hint={`${active.length} of ${seats} seat${seats === 1 ? "" : "s"} in use. Keys unlock the extension and API; they're signed, never stored, and revocable.`}
        right={
          <Button
            size="sm"
            variant="secondary"
            disabled={busy !== null || active.length >= seats}
            title={active.length >= seats ? "Seat limit reached for your plan" : undefined}
            onClick={() =>
              run("new", async () => {
                const label = window.prompt("Label for this key (e.g. “Laptop”)", `Seat ${active.length + 1}`) ?? "";
                if (!label) return;
                const r = await api<{ license: LicenseView; key: string }>("/license", { method: "POST", body: { label } });
                setLicenses((l) => [...l, r.license]);
                setKeys((k) => ({ ...k, [r.license.id]: r.key }));
                setShown((s) => ({ ...s, [r.license.id]: true }));
              })
            }
          >
            <Plus size={14} /> Add seat
          </Button>
        }
      />
      <ul className="space-y-3">
        {licenses.map((l) => (
          <li key={l.id} className="rounded-lg border border-line bg-bg/50 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[14px] font-medium"><KeyRound size={15} className="text-accent" />{l.label}{l.revoked ? <Badge tone="bad">Revoked</Badge> : null}</div>
              <p className="text-[12px] text-faint">{l.lastUsedAt ? `Last used ${new Date(l.lastUsedAt).toLocaleString()}` : "Never used"}</p>
            </div>
            <code className="mt-2.5 block overflow-x-auto whitespace-nowrap rounded-md bg-black/40 px-3 py-2 font-mono text-[12.5px] text-ink">
              {shown[l.id] && keys[l.id] ? keys[l.id] : l.keyPreview}
            </code>
            {!l.revoked ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => reveal(l.id)}>{shown[l.id] ? <EyeOff size={14} /> : <Eye size={14} />}{shown[l.id] ? "Hide" : "Reveal"}</Button>
                {keys[l.id] ? <CopyButton text={keys[l.id]!} label="Copy key" /> : null}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() =>
                    run(l.id, async () => {
                      if (!window.confirm("Rotate this key? The old key stops working immediately and you'll need to paste the new one into the extension.")) return;
                      const r = await api<{ key: string }>(`/license/${l.id}/rotate`, { method: "POST", body: {} });
                      setKeys((k) => ({ ...k, [l.id]: r.key }));
                      setShown((s) => ({ ...s, [l.id]: true }));
                      router.refresh();
                    })
                  }
                >
                  <RotateCw size={14} /> Rotate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null || active.length <= 1}
                  title={active.length <= 1 ? "Keep at least one active key" : undefined}
                  onClick={() =>
                    run(l.id, async () => {
                      if (!window.confirm("Revoke this key permanently?")) return;
                      await api(`/license/${l.id}`, { method: "DELETE" });
                      setLicenses((all) => all.map((x) => (x.id === l.id ? { ...x, revoked: true } : x)));
                    })
                  }
                >
                  <Trash2 size={14} /> Revoke
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <Notice tone="bad" className="mt-3">{error}</Notice> : null}

      <div id="extension" className="mt-6 scroll-mt-24 rounded-lg border border-line bg-white/[.02] p-4">
        <p className="text-[14px] font-medium">Install the extension</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted">
          <li>Build it once: <code className="font-mono text-ink">npm run build:extension</code> (or use the zip from the project release).</li>
          <li>Open <code className="font-mono text-ink">chrome://extensions</code>, enable <b className="text-ink">Developer mode</b>, click <b className="text-ink">Load unpacked</b>, choose <code className="font-mono text-ink">packages/extension/dist</code>.</li>
          <li>Click the GigRadar icon, paste your license key, and set the API URL to <code className="break-all font-mono text-ink">{appUrl}</code> <CopyButton text={appUrl} label="Copy URL" className="ml-1 align-middle" />.</li>
          <li>Open a job board — or the <a href="/demo-board" className="text-accent hover:underline">fixture board</a> — and press <b className="text-ink">Scan this page</b>.</li>
        </ol>
      </div>
    </Card>
  );
}
