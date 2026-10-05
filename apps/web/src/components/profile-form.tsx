"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { TagInput } from "./tag-input";
import { Button, Card, Notice } from "./ui";

export interface ProfileValues {
  headline: string;
  bio: string;
  skills: string[];
  niches: string[];
  excludeKeywords: string[];
  hourlyRateFloor: number;
  minFixedBudget: number | null;
  timezone: string;
  portfolioLinks: string[];
  tone: "professional" | "friendly" | "concise";
  digestEnabled: boolean;
  digestMinScore: number;
}

const field =
  "w-full rounded-lg border border-line-strong bg-bg/70 px-3.5 py-2.5 text-[14.5px] text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";

export function ProfileForm({ initial, digestAllowed }: { initial: ProfileValues; digestAllowed: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<ProfileValues>(initial);
  const [links, setLinks] = useState(initial.portfolioLinks.join("\n"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const zones = useMemo(() => {
    try {
      return (Intl as any).supportedValuesOf("timeZone") as string[];
    } catch {
      return ["UTC"];
    }
  }, []);
  const set = <K extends keyof ProfileValues>(k: K, val: ProfileValues[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const portfolioLinks = links.split(/\n/).map((s) => s.trim()).filter(Boolean);
      const r = await api("/profile", { method: "PUT", body: { ...v, portfolioLinks } });
      const n = r.rescore?.rescored ?? 0;
      setMsg({ tone: "good", text: n ? `Saved. Re-scored ${n} existing ${n === 1 ? "listing" : "listings"} with your new profile.` : "Saved." });
      router.refresh();
    } catch (err: any) {
      setMsg({ tone: "bad", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Card className="space-y-5 p-5">
        <div>
          <label htmlFor="headline" className="block text-[13.5px] font-medium">Headline</label>
          <input id="headline" className={`${field} mt-2`} value={v.headline} maxLength={160} onChange={(e) => set("headline", e.target.value)} placeholder="Full-stack TypeScript engineer — SaaS, billing, AI integrations" />
        </div>
        <TagInput label="Skills" hint="Press Enter or comma to add. Aliases are understood (k8s = Kubernetes, Node = Node.js)." value={v.skills} onChange={(s) => set("skills", s)} placeholder="TypeScript, React, Stripe…" />
        <TagInput label="Niches" hint="Industries or domains you prefer." value={v.niches} onChange={(s) => set("niches", s)} placeholder="SaaS, fintech, crypto…" max={20} />
        <TagInput label="Never show me" hint="Listings containing these words are capped at a low score and never digested." value={v.excludeKeywords} onChange={(s) => set("excludeKeywords", s)} placeholder="unpaid, trial task…" max={20} />
      </Card>

      <Card className="grid gap-5 p-5 sm:grid-cols-3">
        <div>
          <label htmlFor="floor" className="block text-[13.5px] font-medium">Hourly rate floor (USD)</label>
          <input id="floor" type="number" min={0} max={1000} className={`${field} mt-2`} value={v.hourlyRateFloor} onChange={(e) => set("hourlyRateFloor", Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="minfixed" className="block text-[13.5px] font-medium">Minimum fixed budget (USD)</label>
          <input id="minfixed" type="number" min={0} className={`${field} mt-2`} value={v.minFixedBudget ?? ""} placeholder={`Default: ${v.hourlyRateFloor * 10}`} onChange={(e) => set("minFixedBudget", e.target.value === "" ? null : Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="tz" className="block text-[13.5px] font-medium">Timezone</label>
          <select id="tz" className={`${field} mt-2`} value={v.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {[...new Set(["UTC", v.timezone, ...zones])].map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        <div>
          <label htmlFor="bio" className="block text-[13.5px] font-medium">About you</label>
          <p className="mt-0.5 text-[12.5px] text-muted">Drafts use <i>only</i> what&apos;s written here and in your skills. Real projects, real results — the more specific, the better the draft.</p>
          <textarea id="bio" rows={5} className={`${field} mt-2`} value={v.bio} maxLength={2000} onChange={(e) => set("bio", e.target.value)} placeholder="I build billing flows and developer tools. Recently shipped…" />
        </div>
        <div>
          <label htmlFor="links" className="block text-[13.5px] font-medium">Portfolio links <span className="font-normal text-muted">(one per line)</span></label>
          <p className="mt-0.5 text-[12.5px] text-muted">The only links a draft may contain.</p>
          <textarea id="links" rows={3} className={`${field} mt-2 font-mono text-[13px]`} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://yourportfolio.com" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="tone" className="block text-[13.5px] font-medium">Draft tone</label>
            <select id="tone" className={`${field} mt-2`} value={v.tone} onChange={(e) => set("tone", e.target.value as ProfileValues["tone"])}>
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13.5px] font-medium">Daily email digest</p>
            <p className="mt-0.5 text-[12.5px] text-muted">{digestAllowed ? "Top new matches with drafts and your checklist." : "Part of Pro and Studio."}</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" className="peer sr-only" checked={v.digestEnabled} onChange={(e) => set("digestEnabled", e.target.checked)} aria-label="Enable daily digest" />
            <span className="h-6 w-11 rounded-full bg-white/10 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50" />
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
          </label>
        </div>
        <div>
          <label htmlFor="min" className="block text-[13.5px] font-medium">Only include matches scoring at least <span className="tabular-nums text-accent">{v.digestMinScore}</span></label>
          <input id="min" type="range" min={0} max={100} step={5} value={v.digestMinScore} onChange={(e) => set("digestMinScore", Number(e.target.value))} className="mt-3 w-full accent-[var(--color-accent)]" />
        </div>
      </Card>

      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="flex gap-3">
        <Button type="submit" variant="primary" size="lg" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
      </div>
    </form>
  );
}
