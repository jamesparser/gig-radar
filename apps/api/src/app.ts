import { Hono } from "hono";
import { ZodError } from "zod";
import { getContext, type Ctx } from "./context";
import { ApiError } from "./errors";
import type { Env } from "./http";
import { billingRoutes } from "./routes/billing";
import { coreRoutes } from "./routes/core";
import { jobRoutes } from "./routes/jobs";
import { opsRoutes } from "./routes/ops";

/**
 * The GigRadar API. Framework-agnostic Hono app: mounted by Next.js at /api (apps/web) and also runnable
 * standalone (src/server.ts) for Fly/Railway/Docker.
 */
export function createApp(opts: { getCtx?: () => Promise<Ctx> } = {}) {
  const getCtx = opts.getCtx ?? getContext;
  const app = new Hono<Env>().basePath("/api");

  app.use("*", async (c, next) => {
    c.set("ctx", await getCtx());
    await next();
    if (!c.res.headers.has("cache-control")) c.header("cache-control", "no-store");
    c.header("x-content-type-options", "nosniff");
  });

  // Better Auth owns /api/auth/* (sign-up, sign-in, sign-out, session, GitHub OAuth callback).
  app.on(["GET", "POST"], "/auth/*", (c) => c.var.ctx.auth.handler(c.req.raw));

  app.route("/", coreRoutes);
  app.route("/", jobRoutes);
  app.route("/", billingRoutes);
  app.route("/", opsRoutes);

  app.notFound((c) => c.json({ error: { code: "not_found", message: "No such endpoint." } }, 404));

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ error: { code: err.code, message: err.message, ...err.extra } }, err.status);
    }
    if (err instanceof ZodError) {
      return c.json(
        { error: { code: "invalid_request", message: "Some fields are invalid.", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } },
        400,
      );
    }
    console.error("[gigradar] unhandled error", err);
    return c.json({ error: { code: "internal_error", message: "Something went wrong on our side." } }, 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
