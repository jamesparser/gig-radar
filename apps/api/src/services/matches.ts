import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { formatBudget, type Budget, type ClientSignals, type Draft } from "@gigradar/core";
import type { Ctx } from "../context";
import { drafts, jobs, matches, workbenchItems } from "../db/schema";
import { ApiError, notFound } from "../errors";

export const MATCH_STATUSES = ["new", "drafted", "applied", "won", "dismissed"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export interface MatchView {
  id: string;
  jobId: string;
  score: number;
  label: string;
  summary: string;
  redFlags: string[];
  matchedSkills: string[];
  missingSkills: string[];
  disqualified: boolean;
  status: string;
  createdAt: string;
  draftVersion: number | null;
  job: {
    source: string;
    url: string;
    title: string;
    budget: Budget;
    budgetText: string;
    skills: string[];
    client: ClientSignals;
    postedAt: string | null;
  };
}

export interface DraftView extends Draft {
  id: string;
  version: number;
  generatedBy: string;
  createdAt: string;
}

export interface WorkbenchView {
  id: string;
  kind: string;
  title: string;
  content: string;
  generatedBy: string;
  createdAt: string;
}

export interface MatchDetail extends MatchView {
  description: string;
  factors: unknown[];
  draft: DraftView | null;
  workbench: WorkbenchView[];
}

type MatchRow = typeof matches.$inferSelect;
type JobRow = typeof jobs.$inferSelect;

function toView(m: MatchRow, j: JobRow, draftVersion: number | null): MatchView {
  return {
    id: m.id,
    jobId: m.jobId,
    score: m.score,
    label: m.label,
    summary: m.summary,
    redFlags: m.redFlags,
    matchedSkills: m.matchedSkills,
    missingSkills: m.missingSkills,
    disqualified: m.disqualified,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    draftVersion,
    job: {
      source: j.source,
      url: j.url,
      title: j.title,
      budget: j.budget,
      budgetText: formatBudget(j.budget),
      skills: j.skills,
      client: j.client,
      postedAt: j.postedAt?.toISOString() ?? null,
    },
  };
}

export async function listMatches(
  ctx: Ctx,
  userId: string,
  opts: { limit?: number; minScore?: number; status?: string; includeDismissed?: boolean } = {},
): Promise<MatchView[]> {
  const conds = [eq(matches.userId, userId)];
  if (opts.minScore !== undefined) conds.push(gte(matches.score, opts.minScore));
  if (opts.status) conds.push(eq(matches.status, opts.status));
  else if (!opts.includeDismissed) conds.push(sql`${matches.status} <> 'dismissed'`);

  const rows = await ctx.db
    .select({ m: matches, j: jobs })
    .from(matches)
    .innerJoin(jobs, eq(matches.jobId, jobs.id))
    .where(and(...conds))
    .orderBy(desc(matches.score), desc(matches.createdAt))
    .limit(Math.min(opts.limit ?? 50, 200));
  if (rows.length === 0) return [];

  const dv = await ctx.db
    .select({ matchId: drafts.matchId, v: sql<number>`max(${drafts.version})::int` })
    .from(drafts)
    .where(inArray(drafts.matchId, rows.map((r) => r.m.id)))
    .groupBy(drafts.matchId);
  const versions = new Map(dv.map((d) => [d.matchId, Number(d.v)]));
  return rows.map((r) => toView(r.m, r.j, versions.get(r.m.id) ?? null));
}

export async function getMatchRow(ctx: Ctx, userId: string, id: string): Promise<{ m: MatchRow; j: JobRow }> {
  const [row] = await ctx.db
    .select({ m: matches, j: jobs })
    .from(matches)
    .innerJoin(jobs, eq(matches.jobId, jobs.id))
    .where(and(eq(matches.id, id), eq(matches.userId, userId)))
    .limit(1);
  if (!row) throw notFound("Match");
  return row;
}

export async function latestDraft(ctx: Ctx, matchId: string): Promise<DraftView | null> {
  const [d] = await ctx.db.select().from(drafts).where(eq(drafts.matchId, matchId)).orderBy(desc(drafts.version)).limit(1);
  return d ? draftToView(d) : null;
}

export function draftToView(d: typeof drafts.$inferSelect): DraftView {
  return {
    id: d.id,
    version: d.version,
    coverLetter: d.coverLetter,
    milestones: d.milestones,
    clientQuestions: d.clientQuestions,
    youStillMust: d.youStillMust,
    generatedBy: d.generatedBy,
    createdAt: d.createdAt.toISOString(),
  };
}

export async function getMatchDetail(ctx: Ctx, userId: string, id: string): Promise<MatchDetail> {
  const { m, j } = await getMatchRow(ctx, userId, id);
  const draft = await latestDraft(ctx, m.id);
  const wb = await ctx.db.select().from(workbenchItems).where(eq(workbenchItems.matchId, m.id)).orderBy(desc(workbenchItems.createdAt));
  return {
    ...toView(m, j, draft?.version ?? null),
    description: j.description,
    factors: m.factors,
    draft,
    workbench: wb.map((w) => ({ id: w.id, kind: w.kind, title: w.title, content: w.content, generatedBy: w.generatedBy, createdAt: w.createdAt.toISOString() })),
  };
}

export async function setMatchStatus(ctx: Ctx, userId: string, id: string, status: string): Promise<void> {
  if (!(MATCH_STATUSES as readonly string[]).includes(status)) throw new ApiError(400, "bad_status", `Status must be one of ${MATCH_STATUSES.join(", ")}.`);
  await getMatchRow(ctx, userId, id);
  await ctx.db.update(matches).set({ status, updatedAt: ctx.now() }).where(eq(matches.id, id));
}
