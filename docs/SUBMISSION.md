# Submission copy (Devpost) — Galuxium Nexus V2

Draft text for the submission form, written to be pasted and trimmed. Everything claimed here is true of the repository as built; items marked **[fill]** depend on your deployment. Replace nothing with invented numbers: there are no customers or revenue yet, and the copy says so.

---

## Project name

GigRadar

## Tagline

GigRadar finds the gigs that fit and drafts the pitch — you close the deal.

## Links

- Live app (HTTPS): **[fill — Vercel URL]**
- Public repo: https://github.com/jamesparser/gig-radar
- Demo video (2–5 min): **[fill]**
- Pitch deck: **[fill, recommended]**
- Chrome extension (unpacked build or release zip): in the repo release **[fill]**

## Inspiration / the problem

Freelancers on Upwork, Fiverr and Freelancer spend hours a week scrolling listings that don't fit and rewriting nearly the same proposal. The popular answer is auto-apply bots — which marketplaces ban and clients hate. We wanted the opposite: a tool that does the *finding* and the *first draft*, and leaves the judgement and the Submit click to the human.

## What it does

You enter your skills, rate floor, niches and keywords you never want to see. A Chrome extension reads the job listings on the page you have open — only when you press **Scan** — and sends them to GigRadar. Each listing gets a **0–100 fit score with the reasons** (skill overlap, budget vs. your floor, client quality, niche, freshness). On Pro, one click drafts a proposal: **cover letter, three milestones, questions to ask the client, and a "what you still must do" checklist** (read the brief, verify every claim, replace the [placeholders], attach real samples, submit it yourself). A daily email digest lists your best matches with the checklist and a link to open the listing and submit. The extension can prefill the proposal box, but it never presses Submit. Studio adds five seats and a work bench that drafts the post-win kickoff plan and first-deliverable outline.

## How we built it

A TypeScript monorepo: Next.js 16 (App Router) dashboard with a Hono API mounted at `/api` (also runnable standalone), Drizzle on Postgres (Neon in production, embedded PGlite for dev/tests), Better Auth, Stripe Checkout + signed webhooks, Resend for the digest, and a Manifest V3 Chrome extension. The scorer (`fit-v1`) is deterministic and model-free, so the Free tier costs almost nothing to serve. Drafts use an LLM (Anthropic or any OpenAI-compatible endpoint) behind a hardened prompt, with a labelled template fallback. Pro/Studio entitlements are enforced server-side from one plan table; the extension authenticates with **signed license keys** (`gr_<id>_<HMAC>`, derived and never stored, rotatable and revocable) issued after the Stripe webhook upgrades the plan. Architecture diagram, schema and flows: `README.md` and `docs/ARCHITECTURE.md`. Verified with 37 API tests, 26 core tests, 14 extension tests, a production build, and an end-to-end run of the real extension in Chromium.

## Governance, safety and compliance

Built as a co-pilot, not a bot: it reads only the page you open and only when you ask; it stores no marketplace credentials or cookies; it never submits, messages or bids; auto-scan is an opt-in setting that's off by default. Listing text is treated as **untrusted data** in prompts (fenced, JSON-only output validated with zod, links limited to your portfolio, mandatory human steps injected after generation), so a listing that says "ignore your instructions" can't drive the output. Users can export all their data or delete their account (which also cancels the Stripe subscription). Known gaps and the marketplace-terms position are written down in `docs/COMPLIANCE.md` rather than hidden.

## Honest scope notes

- Parsers for the real marketplaces are best-effort and **unverified**; marketplace markup is undocumented and their terms restrict automation. The supported demo path is the built-in **fixture board** (11 fictional listings with documented `data-gr-*` markup), and a generic schema.org `JobPosting` parser handles any board that publishes structured data.
- Stripe runs in **test mode**. There are no real customers, revenue, or testimonials.
- Multi-seat Studio is implemented as five license keys on one account, not a full team model.

## Monetization / fiscal architecture

**Pricing (locked):** Free $0 — 5 scored matches/week, radar only. **Pro $29/mo** — unlimited matching, proposal drafts, email digest, 1 seat. **Studio $99/mo** — 5 seats, work-bench deliverable drafts, priority queue.

**Why this shape.** Free is the acquisition channel and is cheap to serve because scoring is local code, not a model call; the paywall sits on the part that saves hours (drafts + digest), which is also where the variable cost is. Studio prices the multi-seat/agency case at about 3.4× Pro for 5 seats.

**Cost drivers (per user per month).** LLM drafts (variable; capped by a fair-use ceiling, `DRAFTS_PER_DAY`: Pro 100/day, Studio 400/day — a tunable abuse limit, not typical use), Postgres and hosting (small and mostly fixed at this scale), email (digest volume), and payment processing (Stripe's published per-transaction fee plus Billing fees; check current rates). Free users never trigger an LLM call.

**Illustrative unit economics — assumptions, not measurements.** If a Pro user generates a few dozen drafts a month at a few cents each, LLM cost is a small fraction of $29 and gross margin is dominated by Stripe fees (roughly 3%+30¢ on a $29 charge ≈ $1.2). At the cap the economics would be worse, which is why the cap is a single constant to tighten from real usage data. We have **not** measured real usage; the first milestone after launch is instrumenting cost per draft and cost per active user.

**Conversion path.** Free user hits the weekly cap mid-session ("6 listings locked") → Upgrade → Stripe Checkout → webhook issues the license, flips the plan and scores the listings that were locked. Rotating or revoking a key cuts access immediately; a cancelled or unpaid subscription drops the plan back to Free at the next webhook (past-due keeps a grace period while Stripe retries the card).

**What we'd measure next:** cap-hit → upgrade rate, drafts per Pro user, draft → "applied" → "won" funnel (the match status field already tracks it), cost per draft by model, and churn at month 2.

## Challenges

Making unknown data not look like bad data (a listing isn't penalised for facts the page didn't show); keeping the Free quota fair when a profile edit re-scores everything (re-scores are free, only new matches spend quota); making license keys revocable without storing them (version-in-the-signature); treating listing text as hostile input; and resisting the urge to build an auto-apply bot.

## What's next

Verified parsers per marketplace (or official APIs/partnerships), email verification and 2FA, per-seat profiles and organisations for Studio, win/loss feedback to tune scoring weights, and a measured cost model.

## Built with

TypeScript, Next.js, React, Tailwind CSS, Hono, Drizzle ORM, PostgreSQL (Neon / PGlite), Better Auth, Stripe, Resend, Anthropic API / OpenAI-compatible APIs, Chrome Extension Manifest V3, esbuild, Vitest, Playwright (verification).
