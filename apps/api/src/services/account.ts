import { eq } from "drizzle-orm";
import type { Ctx } from "../context";
import { auditEvents, digests, drafts, jobs, licenses, matches, profiles, subscriptions, usageEvents, user, workbenchItems } from "../db/schema";
import { notFound } from "../errors";
import { audit } from "./audit";

/** GDPR-style export: everything we hold about the user, as one JSON document (no password hashes, no license keys). */
export async function exportAccount(ctx: Ctx, userId: string) {
  const [u] = await ctx.db.select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }).from(user).where(eq(user.id, userId)).limit(1);
  if (!u) throw notFound("User");
  const [profile] = await ctx.db.select().from(profiles).where(eq(profiles.userId, userId));
  const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  const lic = await ctx.db.select({ id: licenses.id, label: licenses.label, createdAt: licenses.createdAt, lastUsedAt: licenses.lastUsedAt, revokedAt: licenses.revokedAt }).from(licenses).where(eq(licenses.userId, userId));
  const j = await ctx.db.select().from(jobs).where(eq(jobs.userId, userId));
  const m = await ctx.db.select().from(matches).where(eq(matches.userId, userId));
  const d = await ctx.db.select().from(drafts).where(eq(drafts.userId, userId));
  const w = await ctx.db.select().from(workbenchItems).where(eq(workbenchItems.userId, userId));
  const dg = await ctx.db.select({ id: digests.id, subject: digests.subject, status: digests.status, createdAt: digests.createdAt }).from(digests).where(eq(digests.userId, userId));
  const usage = await ctx.db.select().from(usageEvents).where(eq(usageEvents.userId, userId));
  const aud = await ctx.db.select().from(auditEvents).where(eq(auditEvents.userId, userId));
  await audit(ctx, userId, "account.exported");
  return {
    exportedAt: ctx.now().toISOString(),
    user: u,
    profile: profile ?? null,
    subscription: sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null,
    licenses: lic,
    jobs: j,
    matches: m,
    drafts: d,
    workbench: w,
    digests: dg,
    usage,
    audit: aud,
  };
}

/**
 * Permanently delete the account and everything linked to it (FK cascades). Cancels the Stripe subscription first.
 * The audit trail keeps one opaque row ("account.deleted" + user id, no email/name) as evidence the request was honoured.
 */
export async function deleteAccount(ctx: Ctx, userId: string): Promise<void> {
  const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  if (ctx.stripe && sub?.stripeSubscriptionId) {
    try {
      await ctx.stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    } catch (err) {
      console.warn("[gigradar] could not cancel Stripe subscription during account deletion:", (err as Error).message);
    }
  }
  await ctx.db.delete(user).where(eq(user.id, userId));
  await audit(ctx, null, "account.deleted", { userId });
}
