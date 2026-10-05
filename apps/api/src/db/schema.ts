import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Budget, ClientSignals, Milestone } from "@gigradar/core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/* ------------------------------------------------------------------ */
/* Auth tables — shape required by Better Auth                         */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Product tables                                                      */
/* ------------------------------------------------------------------ */

/** The freelancer's skills profile — the input to scoring and drafting. */
export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  skills: jsonb("skills").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  niches: jsonb("niches").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  excludeKeywords: jsonb("exclude_keywords").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  hourlyRateFloor: real("hourly_rate_floor").notNull().default(40),
  minFixedBudget: real("min_fixed_budget"),
  timezone: text("timezone").notNull().default("UTC"),
  portfolioLinks: jsonb("portfolio_links").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  tone: text("tone").notNull().default("professional"),
  digestEnabled: boolean("digest_enabled").notNull().default(true),
  digestMinScore: integer("digest_min_score").notNull().default(60),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Billing state. One row per user; absent row = Free. Written only by the Stripe webhook (or the dev-only upgrade). */
export const subscriptions = pgTable(
  "subscriptions",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("free"),
    status: text("status").notNull().default("active"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodEnd: ts("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_stripe_sub_uq").on(t.stripeSubscriptionId),
    index("subscriptions_customer_idx").on(t.stripeCustomerId),
  ],
);

/**
 * License keys gate the extension and API. The key itself is NOT stored: it is derived as
 * HMAC(LICENSE_SECRET, id.version) and recomputed on verification. Rotating bumps `version`.
 */
export const licenses = pgTable(
  "licenses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("Default"),
    version: integer("version").notNull().default(1),
    revokedAt: ts("revoked_at"),
    lastUsedAt: ts("last_used_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("licenses_user_idx").on(t.userId)],
);

/** A listing captured by the extension (or loaded from fixtures), per user. */
export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    budget: jsonb("budget").$type<Budget>().notNull(),
    skills: jsonb("skills").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    client: jsonb("client").$type<ClientSignals>().notNull().default(sql`'{}'::jsonb`),
    postedAt: ts("posted_at"),
    capturedAt: ts("captured_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("jobs_user_source_ext_uq").on(t.userId, t.source, t.externalId),
    index("jobs_user_captured_idx").on(t.userId, t.capturedAt),
  ],
);

/** Fit score for a job. A job without a match row = captured but not scored (Free quota exhausted). */
export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .unique()
      .references(() => jobs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    label: text("label").notNull(),
    summary: text("summary").notNull(),
    factors: jsonb("factors").$type<unknown[]>().notNull(),
    redFlags: jsonb("red_flags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    matchedSkills: jsonb("matched_skills").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    missingSkills: jsonb("missing_skills").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    disqualified: boolean("disqualified").notNull().default(false),
    scorerVersion: text("scorer_version").notNull(),
    /** new | drafted | applied | won | dismissed — `applied`/`won` are set by the human, never by us. */
    status: text("status").notNull().default("new"),
    digestedAt: ts("digested_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("matches_user_score_idx").on(t.userId, t.score)],
);

/** Proposal drafts (versioned per match). */
export const drafts = pgTable(
  "drafts",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    coverLetter: text("cover_letter").notNull(),
    milestones: jsonb("milestones").$type<Milestone[]>().notNull(),
    clientQuestions: jsonb("client_questions").$type<string[]>().notNull(),
    youStillMust: jsonb("you_still_must").$type<string[]>().notNull(),
    /** template | template-fallback | anthropic:<model> | openai:<model> */
    generatedBy: text("generated_by").notNull(),
    promptVersion: text("prompt_version").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("drafts_match_idx").on(t.matchId, t.version)],
);

/** Studio: post-win deliverable drafts (kickoff plan, first deliverable outline). */
export const workbenchItems = pgTable(
  "workbench_items",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    generatedBy: text("generated_by").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("workbench_match_idx").on(t.matchId)],
);

/** Every digest we composed: sent via the provider, or kept in the outbox when no provider is configured. */
export const digests = pgTable(
  "digests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    /** sent | outbox | failed */
    status: text("status").notNull(),
    providerMessageId: text("provider_message_id"),
    matchIds: jsonb("match_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("digests_user_idx").on(t.userId, t.createdAt)],
);

/** Metering: one row per billable/limited action. Free quota = match_scored rows since Monday 00:00 UTC. */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** match_scored | draft_generated | digest_sent | workbench_generated */
    kind: text("kind").notNull(),
    refId: text("ref_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("usage_user_kind_idx").on(t.userId, t.kind, t.createdAt)],
);

/** Security/governance trail. Deliberately no FK: the `account.deleted` row outlives the user (opaque id only). */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    type: text("type").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_user_idx").on(t.userId, t.createdAt)],
);

/** Stripe webhook idempotency. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: ts("processed_at").notNull().defaultNow(),
});

export const schema = {
  user,
  session,
  account,
  verification,
  profiles,
  subscriptions,
  licenses,
  jobs,
  matches,
  drafts,
  workbenchItems,
  digests,
  usageEvents,
  auditEvents,
  stripeEvents,
};
