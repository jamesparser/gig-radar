import { Hono } from "hono";
import { z } from "zod";
import { ingestBodySchema } from "@gigradar/core";
import { body, principal, rateLimit, type Env } from "../http";
import { generateDraft } from "../services/drafts";
import { ingestJobs, lockedJobCount, rescoreAll } from "../services/ingest";
import { getMatchDetail, listMatches, setMatchStatus } from "../services/matches";
import { generateWorkbenchItem } from "../services/workbench";

export const jobRoutes = new Hono<Env>();

/** Extension + fixture ingest. Auth: license key (extension) or session (dashboard). */
jobRoutes.post("/jobs", async (c) => {
  const p = await principal(c, ["license", "session"]);
  rateLimit(`jobs:${p.userId}`, 60, 60_000);
  const { jobs } = await body(c, ingestBodySchema);
  return c.json(await ingestJobs(c.var.ctx, p, jobs));
});

jobRoutes.get("/matches", async (c) => {
  const p = await principal(c, ["license", "session"]);
  const q = c.req.query();
  const matches = await listMatches(c.var.ctx, p.userId, {
    limit: q.limit ? Math.min(200, Math.max(1, Number(q.limit) || 50)) : 50,
    minScore: q.minScore ? Number(q.minScore) : undefined,
    status: q.status || undefined,
  });
  return c.json({ matches, lockedJobs: await lockedJobCount(c.var.ctx, p.userId), plan: p.plan });
});

jobRoutes.post("/matches/rescore", async (c) => {
  const p = await principal(c);
  return c.json(await rescoreAll(c.var.ctx, p));
});

jobRoutes.get("/matches/:id", async (c) => {
  const p = await principal(c, ["license", "session"]);
  return c.json(await getMatchDetail(c.var.ctx, p.userId, c.req.param("id")));
});

jobRoutes.patch("/matches/:id", async (c) => {
  const p = await principal(c, ["license", "session"]);
  const { status } = await body(c, z.object({ status: z.string() }));
  await setMatchStatus(c.var.ctx, p.userId, c.req.param("id"), status);
  return c.json({ ok: true });
});

/** Paid feature: proposal draft (cover letter + 3 milestones + client questions + "what you still must do"). */
jobRoutes.post("/matches/:id/draft", async (c) => {
  const p = await principal(c, ["license", "session"]);
  rateLimit(`draft:${p.userId}`, 20, 60_000);
  return c.json({ draft: await generateDraft(c.var.ctx, p, c.req.param("id")) });
});

/** Studio: post-win documents. */
jobRoutes.post("/matches/:id/workbench", async (c) => {
  const p = await principal(c);
  rateLimit(`wb:${p.userId}`, 10, 60_000);
  const { kind } = await body(c, z.object({ kind: z.string() }));
  return c.json({ item: await generateWorkbenchItem(c.var.ctx, p, c.req.param("id"), kind) });
});
