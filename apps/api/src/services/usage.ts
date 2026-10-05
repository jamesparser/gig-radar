import { and, count, eq, gte } from "drizzle-orm";
import { PLANS, startOfIsoWeekUtc, type PlanId } from "@gigradar/core";
import type { Ctx } from "../context";
import { usageEvents } from "../db/schema";
import { newId } from "../lib/crypto";

export type UsageKind = "match_scored" | "draft_generated" | "digest_sent" | "workbench_generated";

export async function recordUsage(ctx: Ctx, userId: string, kind: UsageKind, refId?: string): Promise<void> {
  await ctx.db.insert(usageEvents).values({ id: newId(), userId, kind, refId: refId ?? null, createdAt: ctx.now() });
}

export async function countUsage(ctx: Ctx, userId: string, kind: UsageKind, since: Date): Promise<number> {
  const [row] = await ctx.db
    .select({ n: count() })
    .from(usageEvents)
    .where(and(eq(usageEvents.userId, userId), eq(usageEvents.kind, kind), gte(usageEvents.createdAt, since)));
  return Number(row?.n ?? 0);
}

export interface UsageSummary {
  weekStart: string;
  scoredThisWeek: number;
  weeklyLimit: number | null;
  remaining: number | null;
  drafts30d: number;
  digests30d: number;
  /** Last 14 days, oldest first. */
  series: { day: string; scored: number; drafts: number }[];
}

export async function usageSummary(ctx: Ctx, userId: string, plan: PlanId): Promise<UsageSummary> {
  const now = ctx.now();
  const weekStart = startOfIsoWeekUtc(now);
  const limit = PLANS[plan].weeklyScoredMatches;
  const since30 = new Date(now.getTime() - 30 * 86_400_000);
  const since14 = new Date(now.getTime() - 13 * 86_400_000);
  since14.setUTCHours(0, 0, 0, 0);

  const scoredThisWeek = await countUsage(ctx, userId, "match_scored", weekStart);
  const drafts30d = await countUsage(ctx, userId, "draft_generated", since30);
  const digests30d = await countUsage(ctx, userId, "digest_sent", since30);

  const rows = await ctx.db
    .select({ kind: usageEvents.kind, createdAt: usageEvents.createdAt })
    .from(usageEvents)
    .where(and(eq(usageEvents.userId, userId), gte(usageEvents.createdAt, since14)));

  const buckets = new Map<string, { scored: number; drafts: number }>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since14.getTime() + i * 86_400_000);
    buckets.set(d.toISOString().slice(0, 10), { scored: 0, drafts: 0 });
  }
  for (const r of rows) {
    const b = buckets.get(r.createdAt.toISOString().slice(0, 10));
    if (!b) continue;
    if (r.kind === "match_scored") b.scored++;
    if (r.kind === "draft_generated") b.drafts++;
  }

  return {
    weekStart: weekStart.toISOString(),
    scoredThisWeek,
    weeklyLimit: limit,
    remaining: limit === null ? null : Math.max(0, limit - scoredThisWeek),
    drafts30d,
    digests30d,
    series: [...buckets.entries()].map(([day, v]) => ({ day, ...v })),
  };
}
