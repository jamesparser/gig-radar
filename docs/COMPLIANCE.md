# GigRadar — Governance, privacy and compliance

This document says what GigRadar does and does not do, why, and where it falls short. It is written for engineers and reviewers; the user-facing version is the in-app **Privacy & governance** page (`/privacy`).

## Principle: co-pilot, not bot

GigRadar helps a person find and pitch work. A human is in the loop for every action that touches a marketplace or a client.

| GigRadar does | GigRadar does not |
| --- | --- |
| Read the listing page **you have open**, when you press Scan (auto-scan is an opt-in setting, off by default). | Crawl or poll marketplaces in the background, paginate on its own, or run from a server against marketplace pages. |
| Score listings against the profile **you** wrote. | Infer anything else about you. |
| Draft text, and **prefill** the proposal box with a banner telling you to review it. | Click Submit, send messages, bid, or act as you while logged in. |
| Store the listing text you captured. | Ask for or store marketplace passwords, cookies or session tokens. |
| Tell you what you still must do (read the brief, verify claims, replace placeholders, attach real samples, submit yourself). | Hide automation, spoof a browser, rotate identities, or work around bot detection. |

This is why the extension has a **Scan** button instead of a background crawler, why the prefill never touches the submit control, and why the fixture board's "Submit" button is deliberately inert and says so.

## Marketplace terms

Upwork, Fiverr and Freelancer each have terms about automated access and data collection, and they differ and change. We have not obtained permission from any of them, and GigRadar is **not affiliated with or endorsed by** any marketplace. Practical position:

- The supported evaluation path is the **fixture board**: fictional listings hosted by this app, so the entire loop can be reviewed without touching a marketplace.
- The real-board parsers are best-effort and unverified (see the README status table). Users are responsible for complying with the terms of the sites they use, and the privacy page says so.
- Because GigRadar reads only what the user is already viewing and never submits anything, its footprint is closer to a reading aid than to an auto-apply tool, but that is a design intent, not a legal conclusion. A production launch should get legal review per marketplace and prefer official APIs or partnerships where they exist.

## Data inventory

| Data | Purpose | Retention | User control |
| --- | --- | --- | --- |
| Account (email, name, scrypt password hash or GitHub identity) | Authentication | Until deletion | Delete account |
| Skills profile | Scoring and drafts | Until edited/deleted | Edit, export, delete |
| Captured listings (title, description, budget, skills, public client signals, URL) | Scoring and drafts | Until deletion | Dismiss, export, delete |
| Matches, drafts, work bench documents, digests | The product | Until deletion | Export, delete |
| Subscription (plan, status, Stripe ids) | Billing | Until deletion; Stripe keeps its own records | Customer Portal, delete |
| Usage events | Free quota, fair-use caps | Until deletion | Export, delete |
| Audit events | Security trail (license rotate/revoke, export, delete) — no listing content | Until deletion; one opaque `account.deleted` receipt remains | — |

Card data is handled entirely by Stripe; GigRadar stores customer and subscription ids only. License keys are derived and never stored.

**Export and erasure** are self-service in Settings (`GET /api/account/export`, `DELETE /api/account`). Export excludes password hashes and license keys. Deletion cascades through every user-linked table and cancels the Stripe subscription first.

## AI use and its risks

- Drafts are produced by a third-party LLM chosen by the operator (Anthropic, or any OpenAI-compatible endpoint). **That provider receives the user's profile and the listing text** for each draft. It is a sub-processor for GDPR purposes and would need a DPA in a real deployment. Nothing is sent to the provider for scoring: `fit-v1` is local and deterministic.
- We do not use user data to train models and do not sell it.
- Every draft records `generated_by` and the prompt version. When no model is available, a labelled template is used instead and the UI says so.
- **Hallucination control.** The prompt tells the model to use only profile facts and to insert `[placeholders]` rather than invent experience, clients, numbers or credentials. A post-processor removes links that are not in the user's portfolio. Neither is a guarantee: the mandatory checklist item "check every claim against your real experience" exists because the human is the final control.
- **Prompt injection.** Listing text is untrusted; see [ARCHITECTURE.md](ARCHITECTURE.md#draft-generation-and-prompt-injection-posture). Residual risk: a determined adversarial listing could still steer the wording of a draft the user then reads, which is why drafts are never sent automatically.
- **Fairness of scoring.** `fit-v1` uses only skills, budget, client signals, niche and freshness — no personal attributes — and unknown client data is neutral rather than penalised. It has not been audited for indirect bias (for example, via client country), and the factor weights are a product opinion, not a measured optimum.

## Security controls

Summarised from [ARCHITECTURE.md](ARCHITECTURE.md#security-notes): scrypt password hashing; HTTP-only SameSite cookies; same-origin checks on cookie-authenticated mutations; signed, rotatable, revocable license keys (not stored); Stripe webhook signature verification and idempotency; per-user rate limits; fail-closed production configuration; security headers; no secrets in the client bundle (the extension holds only the user's own license key in `chrome.storage.local`).

## Billing compliance

Checkout, tax handling, receipts and card storage are Stripe's. The demo runs in **Stripe test mode** and says so on the pricing sections. Cancellation and invoices are in the Stripe Customer Portal, linked from Plan & license. A live launch would need: terms of service and refund policy, Stripe Tax or equivalent, and a business entity on the Stripe account.

## Known gaps

Stated so nobody has to discover them:

1. No email verification or 2FA yet.
2. No Content-Security-Policy header on the web app.
3. Rate limiting is in-memory per instance, not distributed.
4. No formal DPA/sub-processor list, cookie banner (only a first-party session cookie is used), or data-processing register.
5. No terms-of-service document in the repo.
6. Real-board parsers are unverified; marketplace permission has not been sought.
7. Draft quality depends on the configured model; the template is intentionally plain.
8. No automated red-team suite for prompt injection beyond the unit tests that cover fencing, link stripping and mandatory steps.
