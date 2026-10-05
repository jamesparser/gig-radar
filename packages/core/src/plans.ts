/**
 * Plans & entitlements — LOCKED pricing (do not change without a product decision).
 * Free = radar only. Paid value = the full loop: match + drafts + digest.
 */

export const ONE_LINER =
  "GigRadar finds the gigs that fit and drafts the pitch — you close the deal.";

export type PlanId = "free" | "pro" | "studio";

export interface PlanDef {
  id: PlanId;
  name: string;
  priceUsdMonthly: number;
  /** Scored matches per ISO week (Mon 00:00 UTC). null = unlimited. */
  weeklyScoredMatches: number | null;
  proposalDrafts: boolean;
  emailDigest: boolean;
  workbench: boolean;
  priorityQueue: boolean;
  /** Seats are implemented as license keys on one account (see docs/ARCHITECTURE.md). */
  seats: number;
  tagline: string;
  features: string[];
  /** Stable Stripe price lookup key (created by `npm run stripe:setup`). */
  stripeLookupKey: string | null;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    priceUsdMonthly: 0,
    weeklyScoredMatches: 5,
    proposalDrafts: false,
    emailDigest: false,
    workbench: false,
    priorityQueue: false,
    seats: 1,
    tagline: "See what fits. Radar only.",
    features: [
      "5 scored matches / week",
      "Fit score 0–100 with the reasons",
      "Chrome extension + dashboard",
    ],
    stripeLookupKey: null,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsdMonthly: 29,
    weeklyScoredMatches: null,
    proposalDrafts: true,
    emailDigest: true,
    workbench: false,
    priorityQueue: false,
    seats: 1,
    tagline: "The full loop for one freelancer.",
    features: [
      "Unlimited matching",
      "Proposal drafts: cover letter, 3 milestones, client questions",
      "Email digest with a “what you still must do” checklist",
      "1 seat",
    ],
    stripeLookupKey: "gigradar_pro_monthly",
  },
  studio: {
    id: "studio",
    name: "Studio",
    priceUsdMonthly: 99,
    weeklyScoredMatches: null,
    proposalDrafts: true,
    emailDigest: true,
    workbench: true,
    priorityQueue: true,
    seats: 5,
    tagline: "For small agencies and duos.",
    features: [
      "Everything in Pro",
      "5 seats",
      "Work bench: post-win deliverable drafts",
      "Priority queue for drafts and digests",
    ],
    stripeLookupKey: "gigradar_studio_monthly",
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "studio"];

export type Feature = "proposalDrafts" | "emailDigest" | "workbench" | "priorityQueue";

export function planAllows(plan: PlanId, feature: Feature): boolean {
  return PLANS[plan][feature];
}

export function isPlanId(v: unknown): v is PlanId {
  return v === "free" || v === "pro" || v === "studio";
}

/** Start of the ISO week (Monday 00:00 UTC) containing `d`. Used for the Free quota window. */
export function startOfIsoWeekUtc(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}
