import { desc, eq } from "drizzle-orm";
import { PLANS, buildDraftPrompt, parseDraftResponse, templateDraft, PROMPT_VERSION, type Draft, type PlanId } from "@gigradar/core";
import type { Ctx } from "../context";
import { drafts, matches } from "../db/schema";
import { ApiError, planRequired } from "../errors";
import { newId } from "../lib/crypto";
import type { Principal } from "../types";
import { audit } from "./audit";
import { getProfile } from "./profile";
import { rowToJob } from "./mappers";
import { draftToView, getMatchRow, type DraftView } from "./matches";
import { countUsage, recordUsage } from "./usage";

/** Fair-use ceilings (per rolling 24h) that protect LLM spend. Not part of the locked pricing table. */
export const DRAFTS_PER_DAY: Record<PlanId, number> = { free: 0, pro: 100, studio: 400 };

export async function generateDraft(ctx: Ctx, principal: Principal, matchId: string): Promise<DraftView> {
  if (!PLANS[principal.plan].proposalDrafts) throw planRequired("Proposal drafts");

  const since = new Date(ctx.now().getTime() - 86_400_000);
  const today = await countUsage(ctx, principal.userId, "draft_generated", since);
  if (today >= DRAFTS_PER_DAY[principal.plan]) {
    throw new ApiError(429, "daily_limit", `Daily draft limit reached (${DRAFTS_PER_DAY[principal.plan]}). Try again tomorrow.`);
  }

  const { m, j } = await getMatchRow(ctx, principal.userId, matchId);
  const { profile } = await getProfile(ctx, principal.userId);
  const job = rowToJob(j);
  const dctx = {
    profile,
    job,
    match: { score: m.score, summary: m.summary, matchedSkills: m.matchedSkills, missingSkills: m.missingSkills, redFlags: m.redFlags },
  };

  let draft: Draft;
  let generatedBy: string;
  if (ctx.llm) {
    try {
      const { system, user } = buildDraftPrompt(dctx);
      const raw = await ctx.llm.complete({ system, user });
      draft = parseDraftResponse(raw, { profile, job });
      generatedBy = ctx.llm.name;
    } catch (err) {
      // Never leave the user empty-handed: fall back to the deterministic template and say so.
      console.warn("[gigradar] LLM draft failed, using template fallback:", (err as Error).message);
      draft = templateDraft(dctx);
      generatedBy = "template-fallback";
    }
  } else {
    draft = templateDraft(dctx);
    generatedBy = "template";
  }

  const [prev] = await ctx.db.select({ v: drafts.version }).from(drafts).where(eq(drafts.matchId, matchId)).orderBy(desc(drafts.version)).limit(1);
  const [row] = await ctx.db
    .insert(drafts)
    .values({
      id: newId(),
      matchId,
      userId: principal.userId,
      version: (prev?.v ?? 0) + 1,
      coverLetter: draft.coverLetter,
      milestones: draft.milestones,
      clientQuestions: draft.clientQuestions,
      youStillMust: draft.youStillMust,
      generatedBy,
      promptVersion: PROMPT_VERSION,
      createdAt: ctx.now(),
    })
    .returning();
  if (m.status === "new") await ctx.db.update(matches).set({ status: "drafted", updatedAt: ctx.now() }).where(eq(matches.id, matchId));
  await recordUsage(ctx, principal.userId, "draft_generated", matchId);
  await audit(ctx, principal.userId, "draft.generated", { matchId, generatedBy, via: principal.via });
  return draftToView(row!);
}

export async function draftsGeneratedToday(ctx: Ctx, userId: string): Promise<number> {
  return countUsage(ctx, userId, "draft_generated", new Date(ctx.now().getTime() - 86_400_000));
}

