# Handoff — what's left for you (Casey)

The code is built and verified locally. These steps need **your accounts, your keys or your voice**, so they weren't done here.

**Deadline:** Oct 31, 2026 **07:30 EDT = 11:30 UTC = 18:30 in Phnom Penh (ICT)**. Aim to submit by **Oct 29** and treat the last two days as buffer.

## 1. Publish the code

- [ ] Create the public repo `jamesparser/gig-radar` and push (`git init -b main && git add -A && git commit -m "GigRadar" && gh repo create jamesparser/gig-radar --public --source=. --push`). The GitHub token available while this was built was invalid, so nothing has been pushed.
- [ ] Confirm the README renders the architecture diagram (`docs/architecture.svg`) and that no link points at `localhost`.

## 2. Deploy (see [DEPLOY.md](DEPLOY.md))

- [ ] Neon (or Supabase) database → `DATABASE_URL`.
- [ ] Vercel project, Root Directory `apps/web`, env vars set, deployed. `/api/health` returns `ok: true` with `db: "postgres"`.
- [ ] Stripe **test** keys → `npm run stripe:setup -- --webhook-url https://gig-radar-omega.vercel.app/api/stripe/webhook` → add the printed values to Vercel → redeploy → enable the Customer Portal.
- [ ] Optional: `ANTHROPIC_API_KEY` (real AI drafts), `RESEND_API_KEY` (real digest email), GitHub OAuth.
- [ ] Put the live URL into the README header and `docs/SUBMISSION.md`.

## 3. Extension

- [ ] `GIGRADAR_API_ORIGIN=https://gig-radar-omega.vercel.app npm run build:extension`, then zip `packages/extension/dist` and attach it to a GitHub release.
- [ ] Load unpacked once yourself and run the smoke test in DEPLOY.md §8, including a real Stripe test checkout (this has **not** been run against Stripe from this repo).

## 4. Record and submit

- [ ] Record the 2–5 minute video following [DEMO-SCRIPT.md](DEMO-SCRIPT.md) (you record it; nothing here can).
- [ ] Pitch deck (recommended by the rules). Ask and I'll draft one from `SUBMISSION.md`.
- [ ] Fill the Devpost form from [SUBMISSION.md](SUBMISSION.md); fill the **https://gig-radar-omega.vercel.app** placeholders (live URL, video, deck, release).
- [ ] Re-read the hackathon's current rules page before submitting: eligibility, required fields, and any "disqualification" rules, since the rules can change after a prompt was written.
- [ ] Submit before the deadline above and keep the confirmation.

## 5. Community items (optional, from the original brief)

These weren't actioned and aren't required by the code: joining the hackathon Discord, claiming partner credits, and the LinkedIn post. If the credits include an LLM provider, they are a natural fit for `ANTHROPIC_API_KEY` / `LLM_*`. Don't post anything claiming customers or revenue — there are none.

## What I could not verify (so you know what to check)

| Item | Status |
| --- | --- |
| Real Upwork/Fiverr/Freelancer parsing | Unverified selectors; fixture board is the supported demo path. Tested only on synthetic markup. |
| Stripe Checkout end to end | Webhook signature handling is unit-tested with Stripe's signing helpers; the live test-mode round trip needs your keys. |
| Live deployment | Production build passes locally; nothing is hosted. |
| Real LLM output quality | Tested with fakes and the template; try your key and read a few drafts. |
| Email delivery | Resend path is a plain HTTPS call, tested with a fake; outbox is the verified fallback. |

## Known limitations worth a sentence in Q&A

Seats are license keys on one account; the in-memory rate limiter is per instance; no email verification/2FA/CSP yet (listed in [COMPLIANCE.md](COMPLIANCE.md)); the Pro draft fair-use cap (100/day) is generous and should be tightened once you've measured cost per draft.
