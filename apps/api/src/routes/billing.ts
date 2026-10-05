import { Hono } from "hono";
import { z } from "zod";
import { PLANS } from "@gigradar/core";
import { ApiError } from "../errors";
import { body, principal, type Env } from "../http";
import { confirmCheckout, createCheckout, createPortal, devSetPlan, handleStripeWebhook } from "../services/billing";
import { createLicense, ensureLicense, listLicenses, revealLicense, revokeLicense, rotateLicense } from "../services/licenses";

export const billingRoutes = new Hono<Env>();

billingRoutes.get("/license", async (c) => {
  const ctx = c.var.ctx;
  const p = await principal(c);
  await ensureLicense(ctx, p.userId);
  return c.json({ licenses: await listLicenses(ctx, p.userId), seats: PLANS[p.plan].seats, plan: p.plan });
});

/** The full key is returned only by create / reveal / rotate — never by the listing. */
billingRoutes.post("/license", async (c) => {
  const p = await principal(c);
  const { label } = await body(c, z.object({ label: z.string().max(60).optional() }));
  return c.json(await createLicense(c.var.ctx, p.userId, label), 201);
});

billingRoutes.post("/license/:id/reveal", async (c) => {
  const p = await principal(c);
  return c.json({ key: await revealLicense(c.var.ctx, p.userId, c.req.param("id")) });
});

billingRoutes.post("/license/:id/rotate", async (c) => {
  const p = await principal(c);
  return c.json({ key: await rotateLicense(c.var.ctx, p.userId, c.req.param("id")) });
});

billingRoutes.delete("/license/:id", async (c) => {
  const p = await principal(c);
  await revokeLicense(c.var.ctx, p.userId, c.req.param("id"));
  return c.json({ ok: true });
});

billingRoutes.post("/billing/checkout", async (c) => {
  const p = await principal(c);
  const { plan } = await body(c, z.object({ plan: z.string() }));
  return c.json(await createCheckout(c.var.ctx, p, plan));
});

billingRoutes.post("/billing/portal", async (c) => {
  const p = await principal(c);
  return c.json(await createPortal(c.var.ctx, p));
});

/** Called by the billing page after Stripe redirects back, so activation doesn't depend on webhook timing. */
billingRoutes.post("/billing/confirm", async (c) => {
  const p = await principal(c);
  const { sessionId } = await body(c, z.object({ sessionId: z.string() }));
  return c.json(await confirmCheckout(c.var.ctx, p, sessionId));
});

/** Local development only (404 in production): flip plans without Stripe. */
billingRoutes.post("/billing/dev-upgrade", async (c) => {
  if (!c.var.ctx.config.allowDevUpgrade) throw new ApiError(404, "not_found", "Not found.");
  const p = await principal(c);
  const { plan } = await body(c, z.object({ plan: z.string() }));
  return c.json({ plan: await devSetPlan(c.var.ctx, p.userId, plan) });
});

/** Stripe → us. Signature-verified against the RAW body; idempotent by event id. */
billingRoutes.post("/stripe/webhook", async (c) => {
  const raw = await c.req.text();
  return c.json(await handleStripeWebhook(c.var.ctx, raw, c.req.header("stripe-signature") ?? null));
});
