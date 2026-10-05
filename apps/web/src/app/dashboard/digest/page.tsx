import type { Metadata } from "next";
import { PLANS } from "@gigradar/core";
import { listDigests } from "@gigradar/api";
import { DigestPanel } from "@/components/digest-panel";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Digest" };

export default async function DigestPage() {
  const { ctx, userId, plan } = await requireUser();
  const history = await listDigests(ctx, userId, 15);
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Email digest</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">Your best new matches with drafts, the checklist of what you still must do, and the link to submit — yourself.</p>
      <DigestPanel allowed={PLANS[plan].emailDigest} history={history} mailerName={ctx.mailer?.name ?? "outbox"} />
    </div>
  );
}
