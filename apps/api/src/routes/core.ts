import { Hono } from "hono";
import { z } from "zod";
import { FIXTURE_PROFILE, PLANS, fixtureJobInputs } from "@gigradar/core";
import { dbHealthy } from "../db/client";
import { body, principal, type Env } from "../http";
import { getEntitlement } from "../services/entitlements";
import { ingestJobs, lockedJobCount, rescoreAll } from "../services/ingest";
import { getProfile, saveProfile } from "../services/profile";
import { usageSummary } from "../services/usage";
import { eq } from "drizzle-orm";
import { user } from "../db/schema";

export const coreRoutes = new Hono<Env>();

coreRoutes.get("/health", async (c) => {
  const ctx = c.var.ctx;
  const ok = await dbHealthy(ctx.db);
  return c.json(
    {
      ok,
      service: "gigradar-api",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      db: ctx.dbKind,
      features: {
        billing: Boolean(ctx.stripe),
        billingWebhook: Boolean(ctx.config.stripe?.webhookSecret),
        email: ctx.mailer?.name ?? "outbox",
        drafts: ctx.llm?.name ?? "template",
        githubLogin: Boolean(ctx.config.github),
      },
    },
    ok ? 200 : 503,
  );
});

/** Who am I + plan + limits + usage. Works with a session or a license key (the extension uses this to validate a pasted key). */
coreRoutes.get("/me", async (c) => {
  const ctx = c.var.ctx;
  const p = await principal(c, ["session", "license"]);
  const [u] = await ctx.db.select({ id: user.id, email: user.email, name: user.name }).from(user).where(eq(user.id, p.userId)).limit(1);
  const ent = await getEntitlement(ctx, p.userId);
  const usage = await usageSummary(ctx, p.userId, p.plan);
  return c.json({
    user: u,
    via: p.via,
    plan: p.plan,
    planDetails: PLANS[p.plan],
    subscription: { status: ent.status, currentPeriodEnd: ent.currentPeriodEnd?.toISOString() ?? null, cancelAtPeriodEnd: ent.cancelAtPeriodEnd, hasBillingAccount: Boolean(ent.stripeCustomerId) },
    usage,
    lockedJobs: await lockedJobCount(ctx, p.userId),
  });
});

coreRoutes.get("/profile", async (c) => {
  const p = await principal(c);
  return c.json(await getProfile(c.var.ctx, p.userId));
});

/** Saving the profile re-scores existing jobs immediately (free) so the dashboard reflects the new skills. */
coreRoutes.put("/profile", async (c) => {
  const ctx = c.var.ctx;
  const p = await principal(c);
  const saved = await saveProfile(ctx, p.userId, await body(c, z.unknown()));
  const rescore = await rescoreAll(ctx, p);
  return c.json({ ...saved, rescore });
});

/** Demo/fixture mode: load a sample profile (if the user has none or asks) and the fictional fixture listings. */
coreRoutes.post("/demo/seed", async (c) => {
  const ctx = c.var.ctx;
  const p = await principal(c);
  const { withProfile } = await body(c, z.object({ withProfile: z.boolean().optional() }));
  const existing = await getProfile(ctx, p.userId);
  const profileSeeded = withProfile === true || !existing.exists || existing.profile.skills.length === 0;
  if (profileSeeded) await saveProfile(ctx, p.userId, FIXTURE_PROFILE);
  const result = await ingestJobs(ctx, p, fixtureJobInputs(ctx.config.appUrl, ctx.now()));
  return c.json({ profileSeeded, ...result });
});
