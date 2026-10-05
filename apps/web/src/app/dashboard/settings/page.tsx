import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings-panel";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { email } = await requireUser();
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">Privacy controls. Read the full <a href="/privacy" className="text-accent hover:underline">privacy &amp; governance</a> note.</p>
      <SettingsPanel email={email} />
    </div>
  );
}
