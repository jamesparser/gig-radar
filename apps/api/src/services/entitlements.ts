import { eq } from "drizzle-orm";
import { isPlanId, type PlanId } from "@gigradar/core";
import type { Ctx } from "../context";
import { subscriptions } from "../db/schema";

export interface Entitlement {
  plan: PlanId;
  /** Raw subscription status, or "none" when the user has never subscribed. */
  status: string;
  stripeCustomerId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/** Subscription states that keep paid features on. `past_due` gets a grace period while Stripe retries the card. */
const ACTIVE = new Set(["active", "trialing", "past_due"]);

export async function getEntitlement(ctx: Ctx, userId: string): Promise<Entitlement> {
  const [row] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  if (!row) return { plan: "free", status: "none", stripeCustomerId: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  const plan: PlanId = ACTIVE.has(row.status) && isPlanId(row.plan) ? row.plan : "free";
  return {
    plan,
    status: row.status,
    stripeCustomerId: row.stripeCustomerId,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  };
}
