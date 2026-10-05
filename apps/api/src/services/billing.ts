import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { PLANS, isPlanId, type PlanId } from "@gigradar/core";
import type { Ctx } from "../context";
import { stripeEvents, subscriptions, user } from "../db/schema";
import { ApiError } from "../errors";
import type { Principal } from "../types";
import { audit } from "./audit";
import { getEntitlement } from "./entitlements";
import { rescoreAll } from "./ingest";
import { ensureLicense } from "./licenses";

type PaidPlan = "pro" | "studio";
const PAID: PaidPlan[] = ["pro", "studio"];
const RANK: Record<PlanId, number> = { free: 0, pro: 1, studio: 2 };

function requireStripe(ctx: Ctx): Stripe {
  if (!ctx.stripe) {
    throw new ApiError(503, "billing_not_configured", "Billing isn't configured on this deployment (STRIPE_SECRET_KEY is not set).");
  }
  return ctx.stripe;
}

/* ------------------------------------------------------------------ */
/* Checkout + portal                                                   */
/* ------------------------------------------------------------------ */

async function priceIdFor(ctx: Ctx, plan: PaidPlan): Promise<string> {
  const configured = ctx.config.stripe?.priceIds[plan];
  if (configured) return configured;
  const key = PLANS[plan].stripeLookupKey!;
  const list = await requireStripe(ctx).prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const price = list.data[0];
  if (!price) {
    throw new ApiError(503, "billing_not_configured", `No active Stripe price with lookup key "${key}". Run \`npm run stripe:setup\` (test mode) or set STRIPE_PRICE_${plan.toUpperCase()}.`);
  }
  return price.id;
}

export async function createCheckout(ctx: Ctx, principal: Principal, plan: string): Promise<{ url: string }> {
  if (!PAID.includes(plan as PaidPlan)) throw new ApiError(400, "bad_plan", "plan must be 'pro' or 'studio'.");
  const stripe = requireStripe(ctx);
  const target = plan as PaidPlan;

  const ent = await getEntitlement(ctx, principal.userId);
  if (RANK[ent.plan] >= RANK[target] && ent.plan !== "free") {
    throw new ApiError(409, "already_subscribed", `You're already on ${PLANS[ent.plan].name}. Use “Manage billing” to change or cancel.`);
  }
  if (ent.plan !== "free" && ent.stripeCustomerId) {
    throw new ApiError(409, "use_portal", "You already have a subscription. Use “Manage billing” to switch plans.");
  }

  const [u] = await ctx.db.select({ email: user.email }).from(user).where(eq(user.id, principal.userId)).limit(1);
  const price = await priceIdFor(ctx, target);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: principal.userId,
    ...(ent.stripeCustomerId ? { customer: ent.stripeCustomerId } : { customer_email: u?.email }),
    metadata: { userId: principal.userId, plan: target },
    subscription_data: { metadata: { userId: principal.userId, plan: target } },
    allow_promotion_codes: true,
    success_url: `${ctx.config.appUrl}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${ctx.config.appUrl}/dashboard/billing?checkout=cancelled`,
  });
  if (!session.url) throw new ApiError(502, "stripe_error", "Stripe did not return a checkout URL.");
  await audit(ctx, principal.userId, "billing.checkout_started", { plan: target });
  return { url: session.url };
}

export async function createPortal(ctx: Ctx, principal: Principal): Promise<{ url: string }> {
  const stripe = requireStripe(ctx);
  const ent = await getEntitlement(ctx, principal.userId);
  if (!ent.stripeCustomerId) throw new ApiError(409, "no_customer", "No billing account yet — subscribe first.");
  const s = await stripe.billingPortal.sessions.create({ customer: ent.stripeCustomerId, return_url: `${ctx.config.appUrl}/dashboard/billing` });
  return { url: s.url };
}

/* ------------------------------------------------------------------ */
/* Applying Stripe state to our DB (shared by webhook + success redirect) */
/* ------------------------------------------------------------------ */

export function planFromSubscription(ctx: Ctx, sub: Stripe.Subscription): PaidPlan | null {
  const price = sub.items.data[0]?.price;
  // Price first: it is the source of truth after a plan switch in the customer portal; metadata can go stale.
  if (price?.lookup_key) {
    for (const p of PAID) if (PLANS[p].stripeLookupKey === price.lookup_key) return p;
  }
  if (price?.id) {
    for (const p of PAID) if (ctx.config.stripe?.priceIds[p] === price.id) return p;
  }
  const meta = sub.metadata?.plan;
  return meta === "pro" || meta === "studio" ? meta : null;
}

async function findUserIdBySubscription(ctx: Ctx, subscriptionId: string, customerId: string): Promise<string | null> {
  const [bySub] = await ctx.db.select({ userId: subscriptions.userId }).from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subscriptionId)).limit(1);
  if (bySub) return bySub.userId;
  const [byCust] = await ctx.db.select({ userId: subscriptions.userId }).from(subscriptions).where(eq(subscriptions.stripeCustomerId, customerId)).limit(1);
  return byCust?.userId ?? null;
}

export async function applySubscription(ctx: Ctx, sub: Stripe.Subscription, userIdHint?: string | null): Promise<{ userId: string; plan: PlanId; status: string } | null> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = userIdHint ?? sub.metadata?.userId ?? (await findUserIdBySubscription(ctx, sub.id, customerId));
  if (!userId) {
    console.warn("[gigradar] Stripe subscription has no matching user:", sub.id);
    return null;
  }
  const [u] = await ctx.db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
  if (!u) {
    console.warn("[gigradar] Stripe subscription refers to an unknown user:", sub.id);
    return null;
  }
  const plan = planFromSubscription(ctx, sub);
  if (!plan) {
    console.warn("[gigradar] Could not map Stripe price to a plan for subscription", sub.id);
    return null;
  }
  const item = sub.items.data[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const periodEndSec = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  const row = {
    plan,
    status: sub.status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: periodEndSec ? new Date(periodEndSec * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    updatedAt: ctx.now(),
  };
  await ctx.db.insert(subscriptions).values({ userId, ...row }).onConflictDoUpdate({ target: subscriptions.userId, set: row });
  const live = ["active", "trialing", "past_due"].includes(sub.status);
  // "webhook → mint license key": make sure the paying user has a key waiting on the billing page.
  if (live) {
    await ensureLicense(ctx, userId);
    // Listings captured while the Free quota was spent are "locked"; score them now that the quota no longer applies.
    try {
      await rescoreAll(ctx, { userId, plan, via: "session" });
    } catch (err) {
      console.warn("[gigradar] post-upgrade rescore failed (non-fatal):", (err as Error).message);
    }
  }
  await audit(ctx, userId, "billing.subscription_synced", { plan, status: sub.status, stripeSubscriptionId: sub.id });
  return { userId, plan: live ? plan : "free", status: sub.status };
}

/** Success-redirect fallback: fulfil from the Checkout Session so activation never depends on webhook timing. */
export async function confirmCheckout(ctx: Ctx, principal: Principal, sessionId: string): Promise<{ plan: PlanId; status: string }> {
  const stripe = requireStripe(ctx);
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new ApiError(400, "bad_session", "Invalid checkout session id.");
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.client_reference_id !== principal.userId) throw new ApiError(403, "forbidden", "This checkout session belongs to another account.");
  if (session.status !== "complete") throw new ApiError(409, "not_complete", "Checkout isn't complete yet.");
  const sub = session.subscription;
  if (!sub || typeof sub === "string") throw new ApiError(502, "stripe_error", "Checkout session has no subscription attached.");
  const applied = await applySubscription(ctx, sub, principal.userId);
  if (!applied) throw new ApiError(502, "stripe_error", "Could not map the subscription to a plan.");
  return { plan: applied.plan, status: applied.status };
}

/* ------------------------------------------------------------------ */
/* Webhook                                                             */
/* ------------------------------------------------------------------ */

export async function handleStripeWebhook(ctx: Ctx, rawBody: string, signature: string | null): Promise<{ received: true; type: string; duplicate: boolean }> {
  const stripe = requireStripe(ctx);
  const secret = ctx.config.stripe?.webhookSecret;
  if (!secret) throw new ApiError(503, "billing_not_configured", "STRIPE_WEBHOOK_SECRET is not set.");
  if (!signature) throw new ApiError(400, "bad_signature", "Missing Stripe-Signature header.");

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch {
    throw new ApiError(400, "bad_signature", "Webhook signature verification failed.");
  }

  const [seen] = await ctx.db.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.id, event.id)).limit(1);
  if (seen) return { received: true, type: event.type, duplicate: true };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await applySubscription(ctx, sub, session.client_reference_id ?? session.metadata?.userId ?? null);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await applySubscription(ctx, event.data.object as Stripe.Subscription);
      break;
    }
    default:
      break; // ignore everything else
  }
  // Record AFTER successful handling: a failed handler returns 5xx and Stripe retries; handlers are idempotent upserts.
  await ctx.db.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing();
  return { received: true, type: event.type, duplicate: false };
}

/* ------------------------------------------------------------------ */
/* Dev-only: simulate an upgrade without Stripe (disabled in production) */
/* ------------------------------------------------------------------ */

export async function devSetPlan(ctx: Ctx, userId: string, plan: string): Promise<PlanId> {
  if (!ctx.config.allowDevUpgrade) throw new ApiError(403, "forbidden", "Not available in production.");
  if (!isPlanId(plan)) throw new ApiError(400, "bad_plan", "plan must be free, pro or studio.");
  const row = { plan, status: "active", cancelAtPeriodEnd: false, updatedAt: ctx.now() };
  await ctx.db.insert(subscriptions).values({ userId, ...row }).onConflictDoUpdate({ target: subscriptions.userId, set: row });
  if (plan !== "free") await ensureLicense(ctx, userId);
  await audit(ctx, userId, "billing.dev_plan_set", { plan });
  return plan;
}
