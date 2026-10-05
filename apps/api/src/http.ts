import type { Context } from "hono";
import type { ZodType, z } from "zod";
import type { Ctx } from "./context";
import { ApiError, unauthorized } from "./errors";
import { getEntitlement } from "./services/entitlements";
import { verifyLicenseKey } from "./services/licenses";
import type { Principal } from "./types";

export type Env = { Variables: { ctx: Ctx } };
export type C = Context<Env>;

export function licenseFromRequest(c: C): string | null {
  const h = c.req.header("x-gigradar-license");
  if (h) return h.trim();
  const auth = c.req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer gr_")) return auth.slice(7).trim();
  return null;
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** Cookie-authenticated mutations must come from our own origin (defence in depth on top of SameSite=Lax). */
function assertSameOrigin(c: C) {
  if (SAFE.has(c.req.method)) return;
  const origin = c.req.header("origin");
  const site = c.req.header("sec-fetch-site");
  if (site === "cross-site") throw new ApiError(403, "forbidden", "Cross-site request blocked.");
  if (origin) {
    let ok = false;
    try {
      ok = new URL(origin).host === new URL(c.var.ctx.config.appUrl).host;
    } catch {
      /* malformed origin */
    }
    if (!ok) throw new ApiError(403, "forbidden", "Cross-origin request blocked.");
  }
}

/** Resolve the caller. `allow` lists which credentials the endpoint accepts. A license key wins if both are present. */
export async function principal(c: C, allow: ("license" | "session")[] = ["session"]): Promise<Principal> {
  const ctx = c.var.ctx;
  if (allow.includes("license")) {
    const key = licenseFromRequest(c);
    if (key) {
      const p = await verifyLicenseKey(ctx, key);
      if (!p) throw new ApiError(401, "invalid_license", "License key is invalid, revoked or was rotated.");
      return p;
    }
  }
  if (allow.includes("session")) {
    const s = await ctx.auth.api.getSession({ headers: c.req.raw.headers });
    if (s?.user) {
      assertSameOrigin(c);
      const ent = await getEntitlement(ctx, s.user.id);
      return { userId: s.user.id, plan: ent.plan, via: "session", email: s.user.email, name: s.user.name };
    }
  }
  throw unauthorized(allow.includes("license") ? "Sign in, or send your license key in the x-gigradar-license header." : "Sign in to continue.");
}

export async function body<T extends ZodType>(c: C, schema: T): Promise<z.output<T>> {
  let raw: unknown = {};
  try {
    const text = await c.req.text();
    if (text.length > 600_000) throw new ApiError(400, "too_large", "Request body too large.");
    raw = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  return schema.parse(raw);
}

/* Best-effort in-memory limiter. On serverless each warm instance has its own window, so this is a brake, not a guarantee;
   plan quotas and daily caps in the database are the authoritative limits. */
const windows = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    windows.set(key, hits);
    throw new ApiError(429, "rate_limited", "Too many requests — slow down a little.");
  }
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > 5000) for (const [k, v] of windows) if (!v.some((t) => now - t < windowMs)) windows.delete(k);
}
