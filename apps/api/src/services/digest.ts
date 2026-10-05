import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { PLANS, formatBudget, renderDigest, type DigestItem, type RenderedEmail } from "@gigradar/core";
import type { Ctx } from "../context";
import { digests, jobs, matches, profiles, subscriptions, user } from "../db/schema";
import { notFound, planRequired } from "../errors";
import { newId } from "../lib/crypto";
import type { Principal } from "../types";
import { audit } from "./audit";
import { generateDraft } from "./drafts";
import { getEntitlement } from "./entitlements";
import { getProfile } from "./profile";
import { latestDraft } from "./matches";
import { recordUsage } from "./usage";

const MAX_ITEMS = 5;

export interface ComposedDigest {
  email: RenderedEmail;
  matchIds: string[];
  to: string;
  itemCount: number;
}

/**
 * Pick the best undigested matches, make sure each has a draft, and render the email.
 * `includeDigested` is for the dashboard preview (show what a digest looks like right now).
 */
export async function composeDigest(ctx: Ctx, principal: Principal, opts: { includeDigested?: boolean } = {}): Promise<ComposedDigest> {
  if (!PLANS[principal.plan].emailDigest) throw planRequired("The email digest");
  const [u] = await ctx.db.select().from(user).where(eq(user.id, principal.userId)).limit(1);
  if (!u) throw notFound("User");
  const { digestMinScore } = await getProfile(ctx, principal.userId);

  const conds = [
    eq(matches.userId, principal.userId),
    gte(matches.score, digestMinScore),
    eq(matches.disqualified, false),
    inArray(matches.status, ["new", "drafted"]),
  ];
  if (!opts.includeDigested) conds.push(isNull(matches.digestedAt));

  const rows = await ctx.db
    .select({ m: matches, j: jobs })
    .from(matches)
    .innerJoin(jobs, eq(matches.jobId, jobs.id))
    .where(and(...conds))
    .orderBy(desc(matches.score), desc(matches.createdAt))
    .limit(MAX_ITEMS);

  const items: DigestItem[] = [];
  for (const { m, j } of rows) {
    let draft = await latestDraft(ctx, m.id);
    if (!draft) {
      try {
        draft = await generateDraft(ctx, principal, m.id);
      } catch (err) {
        console.warn("[gigradar] digest draft skipped:", (err as Error).message);
      }
    }
    items.push({
      title: j.title,
      source: j.source,
      budgetText: formatBudget(j.budget),
      score: m.score,
      label: m.label as DigestItem["label"],
      summary: m.summary,
      redFlags: m.redFlags,
      submitUrl: j.url,
      matchUrl: `${ctx.config.appUrl}/dashboard/matches/${m.id}`,
      draft: draft ? { coverLetter: draft.coverLetter, milestones: draft.milestones, clientQuestions: draft.clientQuestions, youStillMust: draft.youStillMust } : null,
    });
  }

  const email = renderDigest({
    recipientName: u.name,
    appUrl: ctx.config.appUrl,
    items,
    planName: PLANS[principal.plan].name,
    generatedAt: ctx.now(),
  });
  return { email, matchIds: rows.map((r) => r.m.id), to: u.email, itemCount: items.length };
}

export type SendDigestResult =
  | { status: "skipped"; reason: "no_new_matches" }
  | { status: "sent" | "outbox" | "failed"; digestId: string; subject: string; to: string; itemCount: number; error?: string };

export async function sendDigest(ctx: Ctx, principal: Principal): Promise<SendDigestResult> {
  const composed = await composeDigest(ctx, principal);
  if (composed.itemCount === 0) return { status: "skipped", reason: "no_new_matches" };

  const digestId = newId();
  let status: "sent" | "outbox" | "failed" = "outbox";
  let providerMessageId: string | null = null;
  let error: string | null = null;

  if (ctx.mailer) {
    try {
      const r = await ctx.mailer.send({ to: composed.to, subject: composed.email.subject, html: composed.email.html, text: composed.email.text });
      status = "sent";
      providerMessageId = r.id ?? null;
    } catch (err) {
      status = "failed";
      error = (err as Error).message;
      console.error("[gigradar] digest send failed:", error);
    }
  }

  await ctx.db.insert(digests).values({
    id: digestId,
    userId: principal.userId,
    subject: composed.email.subject,
    html: composed.email.html,
    text: composed.email.text,
    status,
    providerMessageId,
    matchIds: composed.matchIds,
    error,
    createdAt: ctx.now(),
  });
  if (status !== "failed") {
    // Mark as digested only once delivered (or stored in the outbox), so a failed send is retried next run.
    await ctx.db.update(matches).set({ digestedAt: ctx.now() }).where(inArray(matches.id, composed.matchIds));
    await recordUsage(ctx, principal.userId, "digest_sent", digestId);
  }
  await audit(ctx, principal.userId, "digest.composed", { digestId, status, items: composed.itemCount });
  return { status, digestId, subject: composed.email.subject, to: composed.to, itemCount: composed.itemCount, ...(error ? { error } : {}) };
}

export async function listDigests(ctx: Ctx, userId: string, limit = 10) {
  const rows = await ctx.db.select().from(digests).where(eq(digests.userId, userId)).orderBy(desc(digests.createdAt)).limit(limit);
  return rows.map((d) => ({ id: d.id, subject: d.subject, status: d.status, createdAt: d.createdAt.toISOString(), itemCount: d.matchIds.length, error: d.error }));
}

export async function getDigest(ctx: Ctx, userId: string, id: string) {
  const [d] = await ctx.db.select().from(digests).where(and(eq(digests.id, id), eq(digests.userId, userId))).limit(1);
  if (!d) throw notFound("Digest");
  return d;
}

/** Cron entry point (Vercel Cron → /api/cron/digest). Sends a digest to every paid user who opted in. */
export async function runDigestJob(ctx: Ctx, limit = 200): Promise<{ users: number; sent: number; outbox: number; skipped: number; failed: number }> {
  const rows = await ctx.db
    .select({ userId: subscriptions.userId, plan: subscriptions.plan })
    .from(subscriptions)
    .leftJoin(profiles, eq(profiles.userId, subscriptions.userId))
    .where(
      and(
        inArray(subscriptions.plan, ["pro", "studio"]),
        inArray(subscriptions.status, ["active", "trialing", "past_due"]),
        sql`coalesce(${profiles.digestEnabled}, true)`,
      ),
    )
    .limit(limit);

  const out = { users: rows.length, sent: 0, outbox: 0, skipped: 0, failed: 0 };
  for (const r of rows) {
    try {
      const ent = await getEntitlement(ctx, r.userId);
      const res = await sendDigest(ctx, { userId: r.userId, plan: ent.plan, via: "session" });
      if (res.status === "sent") out.sent++;
      else if (res.status === "outbox") out.outbox++;
      else if (res.status === "skipped") out.skipped++;
      else out.failed++;
    } catch (err) {
      out.failed++;
      console.error("[gigradar] digest job failed for a user:", (err as Error).message);
    }
  }
  return out;
}


