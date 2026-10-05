import { newId } from "../lib/crypto";
import type { Ctx } from "../context";
import { auditEvents } from "../db/schema";

/** Append to the governance trail. Never throws: auditing must not break the action being audited. */
export async function audit(ctx: Ctx, userId: string | null, type: string, meta: Record<string, unknown> = {}): Promise<void> {
  try {
    await ctx.db.insert(auditEvents).values({ id: newId(), userId, type, meta, createdAt: ctx.now() });
  } catch (err) {
    console.error("[gigradar] audit write failed", type, err);
  }
}
