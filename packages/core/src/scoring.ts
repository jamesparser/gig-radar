import type { Job, Profile } from "./schemas";
import { formatBudget } from "./schemas";
import {
  clean,
  containsTerm,
  skillVariants,
  tagMatchesSkill,
  textMentionsSkill,
  titleCaseSkill,
} from "./text";

/**
 * GigRadar fit scorer (fit-v1). Deterministic, explainable, 0–100.
 *
 *   skills      45  — coverage of the job's tags + how often your skills appear in title/description
 *   budget      20  — job budget vs. your hourly floor / minimum fixed budget
 *   client      15  — payment verified, rating, spend history, hire rate
 *   niche       10  — your niches mentioned in the brief
 *   freshness   10  — how recently posted + how many proposals already in
 *
 * Why not just ask an LLM? A deterministic scorer is cheap enough to run on every listing the
 * extension sees, is auditable (every point has a reason string), and keeps the paid LLM spend for
 * the step that actually needs it: drafting the proposal.
 */

export const SCORER_VERSION = "fit-v1";

export type FactorKey = "skills" | "budget" | "client" | "niche" | "freshness";

export interface ScoreFactor {
  key: FactorKey;
  label: string;
  points: number;
  max: number;
  note: string;
}

export type FitLabel = "Excellent" | "Good" | "Maybe" | "Weak";

export interface MatchScore {
  score: number;
  label: FitLabel;
  summary: string;
  factors: ScoreFactor[];
  redFlags: string[];
  matchedSkills: string[];
  missingSkills: string[];
  disqualified: boolean;
  version: string;
}

const MAX = { skills: 45, budget: 20, client: 15, niche: 10, freshness: 10 } as const;

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function labelFor(score: number): FitLabel {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Maybe";
  return "Weak";
}

export function scoreJob(job: Job, profile: Profile, now: Date = new Date()): MatchScore {
  const redFlags: string[] = [];
  const titleL = clean(job.title);
  const descL = clean(job.description);
  const bodyL = `${titleL} ${descL}`;

  /* ---------------- skills (45) ---------------- */
  const matched: string[] = [];
  let evidence = 0;
  for (const s of profile.skills) {
    let w = 0;
    if (job.skills.some((t) => tagMatchesSkill(t, s))) w = Math.max(w, 1);
    if (textMentionsSkill(titleL, s)) w = Math.max(w, 0.9);
    if (textMentionsSkill(descL, s)) w = Math.max(w, 0.6);
    if (w > 0) {
      matched.push(titleCaseSkill(s));
      evidence += w;
    }
  }
  const saturating = 1 - Math.exp(-evidence / 2);
  const uncoveredTags = job.skills.filter((t) => !profile.skills.some((s) => tagMatchesSkill(t, s)));
  let skillFit: number;
  let skillNote: string;
  if (profile.skills.length === 0) {
    skillFit = 0;
    skillNote = "Add skills to your profile to get a real score";
  } else if (job.skills.length > 0) {
    const coverage = (job.skills.length - uncoveredTags.length) / job.skills.length;
    skillFit = 0.6 * coverage + 0.4 * saturating;
    skillNote = matched.length
      ? `You cover ${job.skills.length - uncoveredTags.length} of ${job.skills.length} listed skills (${matched.slice(0, 4).join(", ")})`
      : "None of your skills appear in the listing";
  } else {
    skillFit = saturating;
    skillNote = matched.length
      ? `Your skills appear in the brief: ${matched.slice(0, 4).join(", ")}`
      : "None of your skills appear in the brief";
  }
  const missing = uncoveredTags.slice(0, 5).map(titleCaseSkill);

  /* ---------------- niche (10) ---------------- */
  let nicheFit: number;
  let nicheNote: string;
  if (profile.niches.length === 0) {
    nicheFit = 0.5;
    nicheNote = "No niches set (neutral)";
  } else {
    const hits = profile.niches.filter((n) => skillVariants(n).some((v) => containsTerm(bodyL, v)));
    const needed = Math.min(2, profile.niches.length);
    nicheFit = clamp(hits.length / needed, 0, 1);
    nicheNote = hits.length ? `Niche match: ${hits.slice(0, 3).join(", ")}` : "No niche keywords in the brief";
  }

  /* ---------------- budget (20) ---------------- */
  const { fit: budgetFit, note: budgetNote, flag: budgetFlag } = budgetFitFor(job, profile);
  if (budgetFlag) redFlags.push(budgetFlag);

  /* ---------------- client (15) ---------------- */
  const c = job.client;
  let clientPts = 0;
  const clientBits: string[] = [];
  if (c.paymentVerified === true) {
    clientPts += 5;
    clientBits.push("payment verified");
  } else if (c.paymentVerified === false) {
    redFlags.push("Client payment method is not verified");
    clientBits.push("payment unverified");
  } else clientPts += 2.5;
  if (c.rating !== undefined) {
    clientPts += c.rating >= 4.5 ? 4 : c.rating >= 4 ? 3 : c.rating >= 3 ? 1.5 : 0;
    clientBits.push(`${c.rating.toFixed(1)}★`);
    if (c.rating < 3 && c.rating > 0) redFlags.push(`Low client rating (${c.rating.toFixed(1)}★)`);
  } else clientPts += 2;
  if (c.totalSpent !== undefined) {
    clientPts += c.totalSpent >= 10_000 ? 3 : c.totalSpent >= 1_000 ? 2 : c.totalSpent > 0 ? 1 : 0;
    clientBits.push(
      c.totalSpent >= 1000 ? `$${Math.round(c.totalSpent / 1000)}k spent` : `$${Math.round(c.totalSpent)} spent`,
    );
  } else clientPts += 1;
  if (c.hireRate !== undefined) {
    clientPts += c.hireRate >= 0.5 ? 3 : c.hireRate >= 0.2 ? 1.5 : 0;
    clientBits.push(`${Math.round(c.hireRate * 100)}% hire rate`);
  } else clientPts += 1.5;
  const clientNote = clientBits.length ? `Client: ${clientBits.join(", ")}` : "Client signals unavailable (neutral)";

  /* ---------------- freshness / competition (10) ---------------- */
  let freshPts = 0;
  const freshBits: string[] = [];
  if (job.postedAt) {
    const ageH = Math.max(0, (now.getTime() - Date.parse(job.postedAt)) / 3_600_000);
    freshPts += ageH < 2 ? 6 : ageH < 12 ? 5 : ageH < 48 ? 3.5 : ageH < 168 ? 2 : 0.5;
    freshBits.push(ageH < 1 ? "posted <1h ago" : ageH < 48 ? `posted ${Math.round(ageH)}h ago` : `posted ${Math.round(ageH / 24)}d ago`);
  } else freshPts += 3;
  if (c.proposals !== undefined) {
    freshPts += c.proposals < 5 ? 4 : c.proposals < 15 ? 3 : c.proposals < 30 ? 2 : c.proposals < 50 ? 1 : 0;
    freshBits.push(`${c.proposals} proposals`);
  } else freshPts += 2;
  const freshNote = freshBits.length ? freshBits.join(", ") : "Timing unknown (neutral)";

  /* ---------------- assemble ---------------- */
  const factors: ScoreFactor[] = [
    { key: "skills", label: "Skill fit", points: round1(skillFit * MAX.skills), max: MAX.skills, note: skillNote },
    { key: "budget", label: "Budget vs. your floor", points: round1(budgetFit * MAX.budget), max: MAX.budget, note: budgetNote },
    { key: "client", label: "Client quality", points: round1(clamp(clientPts, 0, MAX.client)), max: MAX.client, note: clientNote },
    { key: "niche", label: "Niche fit", points: round1(nicheFit * MAX.niche), max: MAX.niche, note: nicheNote },
    { key: "freshness", label: "Freshness & competition", points: round1(clamp(freshPts, 0, MAX.freshness)), max: MAX.freshness, note: freshNote },
  ];

  let total = factors.reduce((a, f) => a + f.points, 0);

  // Hard excludes: an excluded keyword caps the score so it never surfaces as a "match".
  const hitExclude = profile.excludeKeywords.find((k) => containsTerm(bodyL, k));
  let disqualified = false;
  if (hitExclude) {
    disqualified = true;
    total = Math.min(total, 15);
    redFlags.unshift(`Contains a keyword you excluded: “${hitExclude}”`);
  }

  const score = clamp(Math.round(total), 0, 100);
  const label = labelFor(score);

  // Summary = the best two positives + the first red flag.
  const positives = [...factors]
    .filter((f) => f.points / f.max >= 0.6)
    .sort((a, b) => b.points / b.max - a.points / a.max)
    .slice(0, 2)
    .map((f) => f.note);
  const summaryParts = [...positives];
  if (redFlags[0]) summaryParts.push(`⚠ ${redFlags[0]}`);
  if (summaryParts.length === 0) summaryParts.push(skillNote);
  const summary = summaryParts.join(" · ");

  return {
    score,
    label,
    summary,
    factors,
    redFlags,
    matchedSkills: matched,
    missingSkills: missing,
    disqualified,
    version: SCORER_VERSION,
  };
}

/** 0..1 piecewise ratio curve shared by hourly and fixed budgets. */
function ratioFit(ratio: number): number {
  if (ratio >= 1.25) return 1;
  if (ratio >= 1) return 0.85 + ((ratio - 1) / 0.25) * 0.15;
  if (ratio >= 0.75) return 0.4 + ((ratio - 0.75) / 0.25) * 0.45;
  return clamp((ratio / 0.75) * 0.4, 0, 0.4);
}

function budgetFitFor(job: Job, profile: Profile): { fit: number; note: string; flag?: string } {
  const b = job.budget;
  const top = b.max ?? b.min;
  if (b.type === "unknown" || top === undefined) {
    return { fit: 0.5, note: "Budget not listed (neutral)" };
  }
  if (b.currency !== "USD") {
    return { fit: 0.5, note: `${formatBudget(b)} — not converted, treated as neutral` };
  }
  if (b.type === "hourly") {
    if (profile.hourlyRateFloor <= 0) return { fit: 1, note: `${formatBudget(b)} (no floor set)` };
    const ratio = top / profile.hourlyRateFloor;
    const fit = ratioFit(ratio);
    return ratio >= 1
      ? { fit, note: `${formatBudget(b)} meets your $${profile.hourlyRateFloor}/hr floor` }
      : {
          fit,
          note: `${formatBudget(b)} is under your $${profile.hourlyRateFloor}/hr floor`,
          flag: `Top of the range ($${top}/hr) is below your $${profile.hourlyRateFloor}/hr floor`,
        };
  }
  // fixed price: assume a 10-hour minimum engagement at your floor when no explicit minimum is set
  const threshold = profile.minFixedBudget ?? profile.hourlyRateFloor * 10;
  if (threshold <= 0) return { fit: 1, note: `${formatBudget(b)} (no minimum set)` };
  const ratio = top / threshold;
  const fit = ratioFit(ratio);
  return ratio >= 1
    ? { fit, note: `${formatBudget(b)} clears your $${Math.round(threshold).toLocaleString("en-US")} minimum` }
    : {
        fit,
        note: `${formatBudget(b)} is under your $${Math.round(threshold).toLocaleString("en-US")} minimum`,
        flag: `Budget ($${Math.round(top).toLocaleString("en-US")}) is below your $${Math.round(threshold).toLocaleString("en-US")} minimum`,
      };
}

