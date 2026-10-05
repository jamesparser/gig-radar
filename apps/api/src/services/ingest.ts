import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { PLANS, deriveExternalId, scoreJob, type Job, type JobInput, type Profile, jobInputSchema } from "@gigradar/core";
import type { Ctx } from "../context";
import { jobs, matches } from "../db/schema";
import { newId } from "../lib/crypto";
import type { Principal } from "../types";
import { getProfile } from "./profile";
import { countUsage, recordUsage } from "./usage";
import { rowToJob } from "./mappers";
import { startOfIsoWeekUtc } from "@gigradar/core";

export interface IngestItem {
  jobId: string;
  matchId: string | null;
  externalId: string;
  source: string;
  title: string;
  url: string;
  score: number | null;
  label: string | null;
  summary: string | null;
  redFlags: string[];
  matchedSkills: string[];
  missingSkills: string[];
  /** Captured but not scored: the Free plan's weekly quota is used up. */
  locked: boolean;
  /** The user has already scored this listing (re-scored for free with the current profile). */
  alreadyScored: boolean;
}

export interface Quota {
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface IngestResult {
  items: IngestItem[];
  quota: Quota;
  plan: string;
}

interface Run {
  userId: string;
  profile: Profile;
  limit: number | null;
  used: number;
}

async function loadRun(ctx: Ctx, principal: Principal): Promise<Run> {
  const { profile } = await getProfile(ctx, principal.userId);
  const used = await countUsage(ctx, principal.userId, "match_scored", startOfIsoWeekUtc(ctx.now()));
  return { userId: principal.userId, profile, limit: PLANS[principal.plan].weeklyScoredMatches, used };
}

const quotaOf = (run: Run): Quota => ({
  limit: run.limit,
  used: run.used,
  remaining: run.limit === null ? null : Math.max(0, run.limit - run.used),
});

/** Score one stored job: re-score for free if it already has a match, otherwise spend quota (or lock). */
async function processJob(ctx: Ctx, run: Run, jobRow: typeof jobs.$inferSelect, job: Job): Promise<IngestItem> {
  const now = ctx.now();
  const [existing] = await ctx.db.select().from(matches).where(eq(matches.jobId, jobRow.id)).limit(1);
  const base = { jobId: jobRow.id, externalId: jobRow.externalId, source: jobRow.source, title: jobRow.title, url: jobRow.url };

  const canScore = existing !== undefined || run.limit === null || run.used < run.limit;
  if (!canScore) {
    return { ...base, matchId: null, score: null, label: null, summary: null, redFlags: [], matchedSkills: [], missingSkills: [], locked: true, alreadyScored: false };
  }

  const sc = scoreJob(job, run.profile, now);
  const fields = {
    score: sc.score,
    label: sc.label,
    summary: sc.summary,
    factors: sc.factors as unknown[],
    redFlags: sc.redFlags,
    matchedSkills: sc.matchedSkills,
    missingSkills: sc.missingSkills,
    disqualified: sc.disqualified,
    scorerVersion: sc.version,
    updatedAt: now,
  };

  let matchId: string;
  if (existing) {
    matchId = existing.id;
    await ctx.db.update(matches).set(fields).where(eq(matches.id, existing.id));
  } else {
    matchId = newId();
    await ctx.db.insert(matches).values({ id: matchId, jobId: jobRow.id, userId: run.userId, createdAt: now, ...fields });
    await recordUsage(ctx, run.userId, "match_scored", matchId);
    run.used++;
  }
  return {
    ...base,
    matchId,
    score: sc.score,
    label: sc.label,
    summary: sc.summary,
    redFlags: sc.redFlags,
    matchedSkills: sc.matchedSkills,
    missingSkills: sc.missingSkills,
    locked: false,
    alreadyScored: existing !== undefined,
  };
}

/** Insert or merge a captured listing. A later capture may carry a fuller description (detail page vs. list card). */
async function upsertJob(ctx: Ctx, userId: string, job: Job): Promise<typeof jobs.$inferSelect> {
  const externalId = deriveExternalId(job);
  const now = ctx.now();
  const [existing] = await ctx.db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.source, job.source), eq(jobs.externalId, externalId)))
    .limit(1);

  if (existing) {
    const merged = {
      url: job.url,
      title: job.title,
      description: job.description.length >= existing.description.length ? job.description : existing.description,
      budget: job.budget.type !== "unknown" || existing.budget.type === "unknown" ? job.budget : existing.budget,
      skills: job.skills.length >= existing.skills.length ? job.skills : existing.skills,
      client: { ...existing.client, ...job.client },
      postedAt: job.postedAt ? new Date(job.postedAt) : existing.postedAt,
      capturedAt: now,
    };
    const [row] = await ctx.db.update(jobs).set(merged).where(eq(jobs.id, existing.id)).returning();
    return row!;
  }
  const [row] = await ctx.db
    .insert(jobs)
    .values({
      id: newId(),
      userId,
      source: job.source,
      externalId,
      url: job.url,
      title: job.title,
      description: job.description,
      budget: job.budget,
      skills: job.skills,
      client: job.client,
      postedAt: job.postedAt ? new Date(job.postedAt) : null,
      capturedAt: now,
    })
    .returning();
  return row!;
}

export async function ingestJobs(ctx: Ctx, principal: Principal, input: JobInput[]): Promise<IngestResult> {
  const run = await loadRun(ctx, principal);
  const items: IngestItem[] = [];
  for (const raw of input) {
    const parsed = jobInputSchema.parse(raw);
    const row = await upsertJob(ctx, principal.userId, parsed);
    items.push(await processJob(ctx, run, row, rowToJob(row)));
  }
  return { items, quota: quotaOf(run), plan: principal.plan };
}

/**
 * Re-score everything with the current profile (free), then score previously-locked jobs while quota remains.
 * Called after a profile edit and after an upgrade.
 */
export async function rescoreAll(ctx: Ctx, principal: Principal): Promise<{ rescored: number; newlyScored: number; stillLocked: number; quota: Quota }> {
  const run = await loadRun(ctx, principal);
  const rows = await ctx.db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, principal.userId))
    .orderBy(desc(jobs.capturedAt))
    .limit(500);
  let rescored = 0;
  let newlyScored = 0;
  let stillLocked = 0;
  for (const row of rows) {
    const item = await processJob(ctx, run, row, rowToJob(row));
    if (item.locked) stillLocked++;
    else if (item.alreadyScored) rescored++;
    else newlyScored++;
  }
  return { rescored, newlyScored, stillLocked, quota: quotaOf(run) };
}

/** Jobs captured but not scored yet (Free quota exhausted). */
export async function lockedJobCount(ctx: Ctx, userId: string): Promise<number> {
  const [row] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .leftJoin(matches, eq(matches.jobId, jobs.id))
    .where(and(eq(jobs.userId, userId), isNull(matches.id)));
  return Number(row?.n ?? 0);
}
