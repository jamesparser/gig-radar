# GigRadar Chrome extension (Manifest V3)

Scores the job listings on the page you're viewing against your GigRadar profile, shows a badge on each, and (on Pro) drafts a proposal you can copy or prefill. **It never submits anything.**

## Build and load

```bash
# from the repo root
GIGRADAR_API_ORIGIN=https://your-deployment.example npm run build:extension   # defaults to http://localhost:3000
```

Then `chrome://extensions` → **Developer mode** → **Load unpacked** → select `packages/extension/dist`. Click the GigRadar icon, paste your license key (dashboard → **Plan & license**), confirm the address, **Save & connect**.

`GIGRADAR_API_ORIGIN` must be `https://…` (or `http://localhost`). It becomes the default API address, the install-time host permission, and the one non-marketplace origin where the content script injects automatically (for `/demo-board`). Any other address entered in the popup is requested at runtime as an optional permission, from a click. For pages outside the declared matches, the popup injects the content script on demand using `activeTab`.

## What it can and can't do

| Does | Doesn't |
| --- | --- |
| Parse the listings on the active tab when you press **Scan this page** (or on load, only if you enable auto-scan). | Run in the background, paginate, crawl, or call marketplace endpoints. |
| Send those listings and your license key (header `x-gigradar-license`) **to your GigRadar API only**, via the service worker. | Read cookies, passwords, messages or history; use `webRequest`; load remote code. |
| Show shadow-DOM badges (score, label, reasons) and a dismissible summary pill. | Touch the page's own scripts or styles. |
| **Prefill** a proposal textarea (native setter + `input`/`change` events), show a review banner, and append — never overwrite — if you already typed. | Focus or click a submit control, or submit a form. |

Permissions: `storage` (license key + address), `activeTab` + `scripting` (read the tab you opened the popup on). The license key lives in `chrome.storage.local` and is only ever read by the service worker and popup, never by a page.

## Parsers

`src/parsers/index.ts` tries, in order: **fixture** (the app's `/demo-board`, documented `data-gr-*` markup) → **Upwork** → **Freelancer** → **Fiverr** → **JSON-LD `JobPosting`** (any page publishing schema.org structured data).

> **Honesty note.** The Upwork / Freelancer / Fiverr parsers are config-driven, *best-effort and unverified* selector lists (`board.ts` + one config file per site). Those sites' markup is undocumented and changes, and their terms restrict automated access. Tests for them use synthetic markup and prove only the parsing mechanics. The supported, verified path is the fixture board; treat real-board parsing as something to tune and use at your own risk and within each site's terms.

Add a board by writing a `BoardConfig` (selectors for card/title/link/description/budget/skills/client signals) and registering `makeBoardParser(config)` in `parsers/index.ts`, or implement `BoardParser { id, matches(url, doc), parse(doc, url) }` directly. Unknown client facts must be left `undefined`, never guessed — the scorer treats unknown as neutral.

## Layout

```
src/background.ts     service worker: the only API client (GR_ME, GR_INGEST, GR_DRAFT, GR_MATCHES)
src/content.ts        scan + prefill message handlers (idempotent injection guard)
src/overlay.ts        shadow-DOM badges and summary pill (createElement/textContent only)
src/prefill.ts        proposal textarea detection + prefill
src/popup/            popup.html / popup.css / popup.ts
src/parsers/          util, fixture, board (config-driven), upwork, freelancer, fiverr, jsonld, registry
scripts/make-icons.mjs  renders src/icons/*.png from the radar mark (needs sharp)
build.mjs             esbuild → dist/ (3 IIFE bundles) + manifest.json
test/                 jsdom tests; test/fixtures are captures of the app's own /demo-board
```

## Test

```bash
npm test -w @gigradar/extension       # parsers (captured fixture HTML), JSON-LD, prefill
npm run typecheck -w @gigradar/extension
```
