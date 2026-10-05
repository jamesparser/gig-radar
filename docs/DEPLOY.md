# Deploying GigRadar (Vercel + Neon + Stripe test mode)

Target: a public **HTTPS** URL with working sign-up, matching, drafts, billing in Stripe **test mode**, and the extension pointing at it. Budget about 30–40 minutes. Everything below is done in your own accounts — nothing here can be done from the repository alone.

Cost: Vercel Hobby, Neon Free, Stripe test mode, Resend Free and (optionally) LLM usage. Without an LLM key and a Resend key the app still works (template drafts, in-app digest outbox), which is a legitimate demo configuration as long as you say so.

## 0. Push the repository

```bash
git init -b main && git add -A
git commit -m "GigRadar"
gh repo create jamesparser/gig-radar --public --source=. --push
```

The `.gitignore` already excludes `node_modules`, `.next`, `dist`, `.env*` and `.data`.

## 1. Database — Neon (or Supabase)

1. Create a project; copy the **pooled** connection string (it ends in `?sslmode=require`).
2. That is `DATABASE_URL`. There is no migration step: the app applies its embedded migrations on first request, under an advisory lock.

> Production **refuses to boot** without `DATABASE_URL` (so you never lose accounts to an in-memory database by accident).

## 2. Vercel

1. **Add New → Project →** import the repo.
2. **Root Directory:** `apps/web`. Leave "Include source files outside of the Root Directory" **enabled** (the web app imports the workspace packages `apps/api` and `packages/core`). Framework preset: Next.js. Node 22.
3. Add environment variables (Production):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | from Neon |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `LICENSE_SECRET` | `openssl rand -base64 32` (a different value; rotating it invalidates every license key) |
| `CRON_SECRET` | `openssl rand -hex 24` (Vercel sends it as `Authorization: Bearer …` to the cron) |
| `APP_URL` | your production URL, e.g. `https://gig-radar.vercel.app` (or your custom domain). If unset, Vercel's production URL is used. |
| `NEXT_PUBLIC_REPO_URL` | `https://github.com/jamesparser/gig-radar` |

4. Deploy. Check `https://<your-app>/api/health` — expect `{"ok":true,"db":"postgres",…}` and the `features` block showing what is configured.

## 3. Stripe (test mode only)

1. In the Stripe dashboard, switch to **Test mode** and copy the secret key (`sk_test_…`).
2. From your machine, in the repo:

```bash
npm install
STRIPE_SECRET_KEY=sk_test_xxx npm run stripe:setup -- --webhook-url https://<your-app>/api/stripe/webhook
```

   This creates **Pro $29/mo** and **Studio $99/mo** products and prices (keyed by lookup key, safe to re-run), registers the webhook endpoint for `checkout.session.completed` and `customer.subscription.created|updated|deleted`, and prints the values to add to Vercel.
3. Add to Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (printed as `whsec_…`), and optionally `STRIPE_PRICE_PRO` / `STRIPE_PRICE_STUDIO` (the app also finds prices by lookup key). Redeploy.
4. Enable the **Customer Portal** in Stripe (Settings → Billing → Customer portal) so "Manage billing" works.
5. Test: sign up → Plan & license → **Upgrade to Pro — $29** → card `4242 4242 4242 4242`, any future date, any CVC. You should land back on the dashboard on Pro, with a license key available.

`stripe:setup` refuses live keys unless you pass `--live`. Don't. This is a test-mode demo and the UI says so.

## 4. Email digest — Resend (optional)

1. Create a Resend API key → `RESEND_API_KEY`.
2. `EMAIL_FROM`: until you verify a domain, Resend only delivers `onboarding@resend.dev` mail to your own account email — fine for a demo. Default: `GigRadar <onboarding@resend.dev>`.
3. Without a key the digest is composed and stored in the **Digest** page's outbox. The cron in `apps/web/vercel.json` runs `/api/cron/digest` daily at 01:00 UTC; you can also press **Send digest now** in the dashboard for the demo.

## 5. AI drafts (optional)

Set `ANTHROPIC_API_KEY` (model defaults to `claude-sonnet-5-5`; override with `ANTHROPIC_MODEL`) **or** any OpenAI-compatible endpoint with `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`. Without one, drafts come from the labelled template. Each draft shows which one produced it.

## 6. GitHub sign-in (optional)

Create a GitHub OAuth app with callback `https://<your-app>/api/auth/callback/github`, then set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

## 7. Build the extension against your deployment

```bash
GIGRADAR_API_ORIGIN=https://<your-app> npm run build:extension
cd packages/extension/dist && zip -r ../gigradar-extension.zip .
```

Load `packages/extension/dist` unpacked (`chrome://extensions` → Developer mode → Load unpacked), paste the license key from **Plan & license**, and open `https://<your-app>/demo-board`. Upload `gigradar-extension.zip` to the GitHub release if you want judges to install without building.

## 8. Smoke test before you submit

- [ ] `/api/health` is `ok: true`, `db: "postgres"`, billing `true`.
- [ ] Landing page loads over HTTPS with no `localhost` anywhere in the page or README links.
- [ ] Sign up → **Load sample jobs** → matches appear with scores and reasons.
- [ ] Free: only 5 scored, the rest locked. Draft button asks to upgrade.
- [ ] Checkout with the test card → Pro; license key revealed; extension scans `/demo-board` and shows 11 badges.
- [ ] Draft a proposal → cover letter, 3 milestones, questions, "what you still must do"; **Fill proposal box** prefills the fixture form and does **not** submit.
- [ ] Digest: **Send digest now** → outbox entry (or email) with the submit link.
- [ ] Rotate the license key → the extension is refused until you paste the new one.
- [ ] Settings → Export works; (on a throwaway account) Delete works.

## Alternative: standalone API

The API is a plain Hono app. To run it without Next.js (Fly, Railway, Docker): set the same env vars and run `npm run start -w @gigradar/api` (`PORT`, default 8787). The extension's API address and `APP_URL` must then point at wherever the API is reachable.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| 500 and `Missing required env var …` in the logs | A required production variable is unset (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `LICENSE_SECRET`). By design. |
| Sign-in loops or "invalid origin" | `APP_URL` doesn't match the URL you're browsing (custom domain vs `*.vercel.app`). |
| Checkout button says billing isn't configured (503) | `STRIPE_SECRET_KEY` missing, or prices not created (`npm run stripe:setup`). |
| Paid, but still on Free | Webhook not delivered (wrong `STRIPE_WEBHOOK_SECRET`/URL). The success redirect calls `/billing/confirm` as a fallback; check Stripe → Developers → Webhooks for failures. |
| Extension: "Could not reach …" | The API address in the popup is wrong or you didn't allow access to it when prompted. |
| Extension finds 0 listings on a real marketplace | Expected — real-board selectors are unverified. Use `/demo-board`, or tune `packages/extension/src/parsers/*`. |
