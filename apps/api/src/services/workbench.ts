import { eq } from "drizzle-orm";
import {
  PLANS,
  WORKBENCH_KINDS,
  buildWorkbenchPrompt,
  cleanWorkbenchOutput,
  templateWorkbench,
  type WorkbenchKind,
} from "@gigradar/core";
import type { Ctx } from "../context";
import { workbenchItems } from "../db/schema";
import { ApiError, planRequired } from "../errors";
import { newId } from "../lib/crypto";
import type { Principal } from "../types";
import { audit } from "./audit";
import { rowToJob } from "./mappers";
import { getMatchRow, latestDraft, type WorkbenchView } from "./matches";
import { getProfile } from "./profile";
import { recordUsage } from "./usage";

/** Studio: after the human marks a match as WON, draft the first working documents. */
export async function generateWorkbenchItem(ctx: Ctx, principal: Principal, matchId: string, kind: string): Promise<WorkbenchView> {
  if (!PLANS[principal.plan].workbench) throw planRequired("The work bench", "studio");
  if (!(WORKBENCH_KINDS as readonly string[]).includes(kind)) throw new ApiError(400, "bad_kind", `kind must be one of ${WORKBENCH_KINDS.join(", ")}`);

  const { m, j } = await getMatchRow(ctx, principal.userId, matchId);
  if (m.status !== "won") throw new ApiError(409, "not_won", "Mark this gig as won first — the work bench drafts post-win documents.");

  const { profile } = await getProfile(ctx, principal.userId);
  const job = rowToJob(j);
  const draftRow = await latestDraft(ctx, matchId);
  const draft = draftRow ? { coverLetter: draftRow.coverLetter, milestones: draftRow.milestones, clientQuestions: draftRow.clientQuestions, youStillMust: draftRow.youStillMust } : null;
  const wctx = { kind: kind as WorkbenchKind, profile, job, draft };

  let title: string;
  let content: string;
  let generatedBy: string;
  const fallback = templateWorkbench(wctx);
  if (ctx.llm) {
    try {
      const { system, user } = buildWorkbenchPrompt(wctx);
      content = cleanWorkbenchOutput(await ctx.llm.complete({ system, user, maxTokens: 1400 }), profile);
      if (content.length < 80) throw new Error("output too short");
      title = fallback.title;
      generatedBy = ctx.llm.name;
    } catch (err) {
      console.warn("[gigradar] LLM workbench failed, using template:", (err as Error).message);
      ({ title, content } = fallback);
      generatedBy = "template-fallback";
    }
  } else {
    ({ title, content } = fallback);
    generatedBy = "template";
  }

  const [row] = await ctx.db
    .insert(workbenchItems)
    .values({ id: newId(), matchId, userId: principal.userId, kind, title, content, generatedBy, createdAt: ctx.now() })
    .returning();
  await recordUsage(ctx, principal.userId, "workbench_generated", matchId);
  await audit(ctx, principal.userId, "workbench.generated", { matchId, kind, generatedBy });
  return { id: row!.id, kind, title, content, generatedBy, createdAt: row!.createdAt.toISOString() };
}

export async function listWorkbench(ctx: Ctx, matchId: string) {
  return ctx.db.select().from(workbenchItems).where(eq(workbenchItems.matchId, matchId));
}
