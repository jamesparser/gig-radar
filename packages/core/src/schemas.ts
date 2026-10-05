import { z } from "zod";

export const SOURCES = ["upwork", "fiverr", "freelancer", "fixture", "other"] as const;
export type Source = (typeof SOURCES)[number];
export const sourceSchema = z.enum(SOURCES);

/** http(s) only — zod's z.url() alone also accepts javascript:, data:, etc. */
export const httpUrl = (max: number) => z.url({ protocol: /^https?$/ }).max(max);

const cleanList = (max: number, itemMax = 60) =>
  z
    .array(z.string().trim().min(1).max(itemMax))
    .max(max)
    .default([])
    .transform((arr) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const s of arr) {
        const k = s.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          out.push(s);
        }
      }
      return out;
    });

/* ------------------------------------------------------------------ */
/* Freelancer skills profile                                           */
/* ------------------------------------------------------------------ */

export const profileSchema = z.object({
  headline: z.string().trim().max(160).default(""),
  bio: z.string().trim().max(2000).default(""),
  skills: cleanList(50),
  niches: cleanList(20),
  excludeKeywords: cleanList(20),
  hourlyRateFloor: z.number().min(0).max(1000).default(40),
  minFixedBudget: z.number().min(0).max(1_000_000).nullable().default(null),
  timezone: z.string().trim().max(60).default("UTC"),
  portfolioLinks: z.array(httpUrl(500)).max(10).default([]),
  tone: z.enum(["professional", "friendly", "concise"]).default("professional"),
});
export type Profile = z.output<typeof profileSchema>;
export type ProfileInput = z.input<typeof profileSchema>;

/* ------------------------------------------------------------------ */
/* Job listing as captured by the extension / fixture API              */
/* ------------------------------------------------------------------ */

export const budgetSchema = z.object({
  type: z.enum(["hourly", "fixed", "unknown"]).default("unknown"),
  min: z.number().nonnegative().max(10_000_000).optional(),
  max: z.number().nonnegative().max(10_000_000).optional(),
  currency: z.string().trim().length(3).toUpperCase().default("USD"),
});
export type Budget = z.output<typeof budgetSchema>;

export const clientSchema = z.object({
  paymentVerified: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
  totalSpent: z.number().nonnegative().optional(),
  hireRate: z.number().min(0).max(1).optional(),
  country: z.string().trim().max(60).optional(),
  proposals: z.number().int().nonnegative().optional(),
});
export type ClientSignals = z.output<typeof clientSchema>;

const lenientIso = z
  .string()
  .max(64)
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    const t = Date.parse(v);
    return Number.isNaN(t) ? undefined : new Date(t).toISOString();
  });

export const jobInputSchema = z.object({
  source: sourceSchema,
  externalId: z.string().trim().min(1).max(200).optional(),
  url: httpUrl(2000),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(8000).default(""),
  budget: budgetSchema.default({ type: "unknown", currency: "USD" }),
  skills: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  client: clientSchema.default({}),
  postedAt: lenientIso,
});
export type JobInput = z.input<typeof jobInputSchema>;
export type Job = z.output<typeof jobInputSchema>;

export const ingestBodySchema = z.object({
  jobs: z.array(jobInputSchema).min(1).max(50),
});

/* ------------------------------------------------------------------ */
/* Proposal draft                                                      */
/* ------------------------------------------------------------------ */

export const milestoneSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(600),
  durationDays: z.number().int().min(1).max(180),
  percentOfBudget: z.number().min(0).max(100),
});
export type Milestone = z.output<typeof milestoneSchema>;

export const draftSchema = z.object({
  coverLetter: z.string().trim().min(40).max(4000),
  milestones: z.array(milestoneSchema).length(3),
  clientQuestions: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
  youStillMust: z.array(z.string().trim().min(1).max(300)).min(1).max(10),
});
export type Draft = z.output<typeof draftSchema>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Stable external id: explicit id, else a short hash of the normalized URL. */
export function deriveExternalId(job: Pick<Job, "externalId" | "url">): string {
  if (job.externalId) return job.externalId;
  return fnv1a(normalizeUrl(job.url));
}

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    // Drop common tracking params; keep everything else (some boards key jobs on query params).
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|referrer$|source$|fbclid$|gclid$)/i.test(k)) u.searchParams.delete(k);
    }
    u.hostname = u.hostname.toLowerCase();
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

/** Small non-crypto hash (FNV-1a, 64-bit via two 32-bit lanes) → 16 hex chars. */
export function fnv1a(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function formatBudget(b: Budget): string {
  const cur = b.currency === "USD" ? "$" : `${b.currency} `;
  const num = (n: number) => `${cur}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (b.type === "unknown" || (b.min === undefined && b.max === undefined)) return "Budget not listed";
  const range =
    b.min !== undefined && b.max !== undefined && b.min !== b.max
      ? `${num(b.min)}–${num(b.max)}`
      : num((b.max ?? b.min) as number);
  return b.type === "hourly" ? `${range}/hr` : `${range} fixed`;
}
