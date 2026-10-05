/** Shapes shared by the parsers, content script, background worker and popup. Mirrors @gigradar/core's JobInput. */

export type Source = "upwork" | "fiverr" | "freelancer" | "fixture" | "other";

export interface Budget {
  type: "hourly" | "fixed" | "unknown";
  min?: number;
  max?: number;
  currency: string;
}

export interface ClientSignals {
  paymentVerified?: boolean;
  rating?: number;
  totalSpent?: number;
  hireRate?: number;
  country?: string;
  proposals?: number;
}

export interface ParsedJob {
  source: Source;
  externalId?: string;
  url: string;
  title: string;
  description: string;
  budget: Budget;
  skills: string[];
  client: ClientSignals;
  postedAt?: string;
}

export interface ParsedPage {
  /** Which parser produced this ("fixture", "upwork", "jsonld", …). */
  parser: string;
  page: "list" | "detail" | "unknown";
  jobs: ParsedJob[];
  /** Parallel to `jobs`: the DOM element each job came from (used for in-page badges; never serialised). */
  elements: (Element | null)[];
}

export interface BoardParser {
  id: string;
  label: string;
  /** True when this parser should handle the current page. */
  matches(url: URL, doc: Document): boolean;
  parse(doc: Document, url: URL): ParsedPage;
}

/* ---- API result shapes (subset of apps/api responses the UI uses) ---- */

export interface IngestItem {
  jobId: string;
  matchId: string | null;
  externalId: string;
  source: string;
  title: string;
  url: string;
  score: number | null;
  label: string | null;
  summary: string | null;
  redFlags: string[];
  matchedSkills: string[];
  missingSkills: string[];
  locked: boolean;
  alreadyScored: boolean;
}

export interface IngestResult {
  items: IngestItem[];
  quota: { limit: number | null; used: number; remaining: number | null };
  plan: "free" | "pro" | "studio";
}

export interface Draft {
  id: string;
  version: number;
  coverLetter: string;
  milestones: { title: string; description: string; durationDays: number; percentOfBudget: number }[];
  clientQuestions: string[];
  youStillMust: string[];
  generatedBy: string;
}

export interface MeResult {
  user: { id: string; email: string; name: string };
  plan: "free" | "pro" | "studio";
  usage: { scoredThisWeek: number; weeklyLimit: number | null; remaining: number | null };
}

export interface MatchListItem {
  id: string;
  score: number;
  label: string;
  summary: string;
  status: string;
  job: { title: string; url: string; source: string; budgetText: string };
}

/* ---- message protocol ---- */

export type BgRequest =
  | { type: "GR_ME" }
  | { type: "GR_INGEST"; jobs: ParsedJob[] }
  | { type: "GR_DRAFT"; matchId: string }
  | { type: "GR_MATCHES" };

export type BgResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: { status: number; code: string; message: string } };

export type TabRequest = { type: "GR_SCAN" } | { type: "GR_PREFILL"; text: string } | { type: "GR_PING" };

export type ScanResponse =
  | { ok: true; parser: string; page: ParsedPage["page"]; found: number; result: IngestResult | null; hasProposalForm: boolean; note?: string }
  | { ok: false; error: string; code?: string };

export type PrefillResponse = { ok: true } | { ok: false; error: string };

export interface Settings {
  apiBase: string;
  licenseKey: string;
  autoScan: boolean;
}
