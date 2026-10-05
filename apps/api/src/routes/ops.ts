import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../errors";
import { safeEqual } from "../lib/crypto";
import { body, principal, type Env } from "../http";
import { deleteAccount, exportAccount } from "../services/account";
import { composeDigest, getDigest, listDigests, runDigestJob, sendDigest } from "../services/digest";

export const opsRoutes = new Hono<Env>();

opsRoutes.get("/digest/preview", async (c) => {
  const p = await principal(c);
  const d = await composeDigest(c.var.ctx, p, { includeDigested: true });
  return c.json({ subject: d.email.subject, html: d.email.html, text: d.email.text, itemCount: d.itemCount, to: d.to });
});

opsRoutes.post("/digest/send", async (c) => {
  const p = await principal(c);
  return c.json(await sendDigest(c.var.ctx, p));
});

opsRoutes.get("/digests", async (c) => {
  const p = await principal(c);
  return c.json({ digests: await listDigests(c.var.ctx, p.userId) });
});

opsRoutes.get("/digests/:id", async (c) => {
  const p = await principal(c);
  const d = await getDigest(c.var.ctx, p.userId, c.req.param("id"));
  return c.json({ id: d.id, subject: d.subject, html: d.html, text: d.text, status: d.status, createdAt: d.createdAt.toISOString() });
});

/** Scheduled digest run. Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`. */
async function cron(c: import("../http").C) {
  const secret = c.var.ctx.config.cronSecret;
  if (!secret) throw new ApiError(503, "cron_not_configured", "CRON_SECRET is not set.");
  const given = (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given || !safeEqual(given, secret)) throw new ApiError(401, "unauthorized", "Bad cron secret.");
  return c.json(await runDigestJob(c.var.ctx));
}
opsRoutes.get("/cron/digest", cron);
opsRoutes.post("/cron/digest", cron);

opsRoutes.get("/account/export", async (c) => {
  const p = await principal(c);
  const data = await exportAccount(c.var.ctx, p.userId);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="gigradar-export.json"', "cache-control": "no-store" },
  });
});

opsRoutes.delete("/account", async (c) => {
  const p = await principal(c);
  const { confirm } = await body(c, z.object({ confirm: z.string() }));
  if (confirm !== "DELETE") throw new ApiError(400, "confirm_required", 'Send {"confirm":"DELETE"} to permanently delete your account.');
  await deleteAccount(c.var.ctx, p.userId);
  return c.json({ ok: true });
});
