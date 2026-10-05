import { DEFAULT_API_BASE, getSettings, saveSettings } from "../settings";
import type { BgRequest, BgResponse, Draft, IngestItem, MatchListItem, MeResult, ScanResponse, TabRequest } from "../types";

/**
 * Popup UI. All DOM is built with createElement/textContent — listing titles and AI drafts are untrusted text.
 * The popup never sends a proposal anywhere: it can copy a draft, or ask the page to prefill the proposal box.
 */

type View = "setup" | "main";
interface State {
  view: View;
  tab: "page" | "top";
  me: MeResult | null;
  scan: Extract<ScanResponse, { ok: true }> | null;
  scanning: boolean;
  scanError: string | null;
  matches: { matches: MatchListItem[]; plan: string } | null;
  matchesError: string | null;
  draft: { matchId: string; title: string; data: Draft } | null;
  draftingId: string | null;
  draftError: { matchId: string; message: string; code?: string } | null;
  settingsError: string | null;
  busy: boolean;
  apiBase: string;
  autoScan: boolean;
  notice: string | null;
}

const st: State = {
  view: "main", tab: "page", me: null, scan: null, scanning: false, scanError: null, matches: null, matchesError: null,
  draft: null, draftingId: null, draftError: null, settingsError: null, busy: false, apiBase: DEFAULT_API_BASE, autoScan: false, notice: null,
};

const app = document.getElementById("app") as HTMLElement;
const planChip = document.getElementById("plan") as HTMLElement;

type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k in el && k !== "list") (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid) el.append(kid);
  return el;
}

const send = <T,>(msg: BgRequest): Promise<BgResponse<T>> => chrome.runtime.sendMessage(msg) as Promise<BgResponse<T>>;

function safeHttp(u: string): string | null {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
const openUrl = (u: string) => {
  const safe = safeHttp(u);
  if (safe) void chrome.tabs.create({ url: safe });
};

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

async function toTab<T>(tabId: number, msg: TabRequest): Promise<T> {
  return (await chrome.tabs.sendMessage(tabId, msg)) as T;
}

/** Make sure our content script is in the tab (declared matches inject automatically; other pages use activeTab). */
async function ensureContentScript(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) throw new Error("No active tab.");
  try {
    await toTab(tab.id, { type: "GR_PING" });
    return;
  } catch {
    /* not injected yet */
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch {
    throw new Error("GigRadar can't run on this kind of page. Open a job listing page and try again.");
  }
}

/* ---------------------------------- actions ---------------------------------- */

async function connect() {
  st.busy = true;
  st.settingsError = null;
  render();
  const s = await getSettings();
  if (!s.licenseKey) {
    st.view = "setup";
    st.busy = false;
    render();
    return;
  }
  st.apiBase = s.apiBase;
  st.autoScan = s.autoScan;
  const r = await send<MeResult>({ type: "GR_ME" });
  st.busy = false;
  if (r.ok) {
    st.me = r.data;
    st.view = "main";
  } else {
    st.me = null;
    st.view = "setup";
    st.settingsError = r.error.message;
  }
  render();
}

async function saveAndConnect(license: string, apiBase: string, autoScan: boolean) {
  st.settingsError = null;
  const key = license.trim();
  const base = apiBase.trim().replace(/\/$/, "");
  if (!/^gr_[A-Za-z0-9_-]{10,}$/.test(key)) {
    st.settingsError = "That doesn't look like a GigRadar key. It starts with gr_ — copy it from Dashboard → Billing.";
    return render();
  }
  const safe = safeHttp(base);
  if (!safe) {
    st.settingsError = "The API URL must start with https:// (or http://localhost for local development).";
    return render();
  }
  const origin = new URL(safe).origin;
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (origin.startsWith("http://") && !isLocal) {
    st.settingsError = "Use https:// — your license key is sent to this address.";
    return render();
  }
  // Ask for access to that one origin (must happen inside the click handler's user gesture).
  try {
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      st.settingsError = `Allow GigRadar to talk to ${origin} so it can score listings.`;
      return render();
    }
  } catch (err) {
    st.settingsError = (err as Error).message;
    return render();
  }
  await saveSettings({ licenseKey: key, apiBase: origin, autoScan });
  await connect();
}

async function runScan() {
  st.notice = null;
  st.scanning = true;
  st.scanError = null;
  st.draft = null;
  st.draftError = null;
  render();
  try {
    const tab = await activeTab();
    if (!tab) throw new Error("No active tab.");
    await ensureContentScript(tab);
    const res = await toTab<ScanResponse>(tab.id!, { type: "GR_SCAN" });
    if (!res.ok) {
      st.scanError = res.error;
      if (res.code === "invalid_license" || res.code === "no_license") {
        st.view = "setup";
        st.settingsError = res.error;
      }
    } else {
      st.scan = res;
      void refreshMe();
    }
  } catch (err) {
    st.scanError = (err as Error).message;
  }
  st.scanning = false;
  render();
}

async function refreshMe() {
  const r = await send<MeResult>({ type: "GR_ME" });
  if (r.ok) {
    st.me = r.data;
    render();
  }
}

async function loadMatches() {
  st.matchesError = null;
  const r = await send<{ matches: MatchListItem[]; plan: string }>({ type: "GR_MATCHES" });
  if (r.ok) st.matches = r.data;
  else st.matchesError = r.error.message;
  render();
}

async function draftFor(matchId: string, title: string) {
  st.notice = null;
  st.draftingId = matchId;
  st.draftError = null;
  st.draft = null;
  render();
  const r = await send<Draft>({ type: "GR_DRAFT", matchId });
  st.draftingId = null;
  if (r.ok) st.draft = { matchId, title, data: r.data };
  else st.draftError = { matchId, message: r.error.message, code: r.error.code };
  render();
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    st.notice = `${what} copied.`;
  } catch {
    st.notice = "Couldn't copy automatically — select the text and copy it.";
  }
  render();
}

async function fillForm(text: string) {
  try {
    const tab = await activeTab();
    if (!tab?.id) throw new Error("No active tab.");
    await ensureContentScript(tab);
    const res = await toTab<{ ok: boolean; error?: string }>(tab.id, { type: "GR_PREFILL", text });
    st.notice = res.ok ? "Filled the proposal box. Review it — you press Submit." : (res.error ?? "Couldn't fill the form.");
  } catch (err) {
    st.notice = (err as Error).message;
  }
  render();
}

/* ----------------------------------- views ----------------------------------- */

function scoreBadge(item: { score: number | null; label: string | null; locked?: boolean }) {
  const cls = item.locked ? "s-lock" : item.label === "Excellent" ? "s-exc" : item.label === "Good" ? "s-good" : item.label === "Maybe" ? "s-maybe" : "s-weak";
  return h("div", { class: `score ${cls}`, "aria-label": item.locked ? "Locked" : `Score ${item.score} of 100, ${item.label}` }, item.locked ? "\u{1F512}" : String(item.score), h("small", {}, item.locked ? "locked" : (item.label ?? "")));
}

function upgradeLink(text = "Upgrade to Pro") {
  return h("button", { class: "link", type: "button", onClick: () => openUrl(`${st.apiBase}/dashboard/billing`) }, text);
}

function canDraft() {
  return st.me ? st.me.plan !== "free" : false;
}

function resultCard(item: IngestItem): HTMLElement {
  const drafting = st.draftingId === item.matchId;
  const err = st.draftError && st.draftError.matchId === item.matchId ? st.draftError : null;
  return h("div", { class: "card" },
    h("div", { class: "head" },
      scoreBadge({ score: item.score, label: item.label, locked: item.locked }),
      h("div", {},
        h("div", { class: "title" }, item.title),
        item.locked
          ? h("div", { class: "sum" }, "Saved, not scored — your Free weekly matches are used up. Pro scores everything.")
          : h("div", { class: "sum" }, item.summary ?? ""),
        item.redFlags.length ? h("div", { class: "flag" }, `⚠ ${item.redFlags[0]}`) : null,
      ),
    ),
    h("div", { class: "actions" },
      item.matchId && !item.locked
        ? canDraft()
          ? h("button", { class: "btn small", type: "button", disabled: drafting || st.draftingId !== null, onClick: () => void draftFor(item.matchId!, item.title) }, drafting ? "Drafting…" : "Draft proposal")
          : h("span", { class: "note" }, "Drafts are a Pro feature. ", upgradeLink())
        : null,
      h("button", { class: "btn small ghost", type: "button", onClick: () => openUrl(item.url) }, "Open listing"),
    ),
    err ? h("div", { class: "err" }, err.message, err.code === "plan_required" ? " " : null, err.code === "plan_required" ? upgradeLink() : null) : null,
  );
}

function draftView(d: NonNullable<State["draft"]>): HTMLElement {
  const dr = d.data;
  return h("div", { class: "card draft" },
    h("h2", {}, `Draft for: ${d.title}`),
    h("div", { class: "note" }, `Generated by ${dr.generatedBy}. It's a starting point — you edit it and you send it.`),
    h("h3", {}, "Cover letter"),
    h("pre", {}, dr.coverLetter),
    h("div", { class: "actions" },
      h("button", { class: "btn small", type: "button", onClick: () => void copy(dr.coverLetter, "Cover letter") }, "Copy cover letter"),
      st.scan?.hasProposalForm ? h("button", { class: "btn small ghost", type: "button", onClick: () => void fillForm(dr.coverLetter) }, "Fill proposal box") : null,
    ),
    h("h3", {}, "Milestones"),
    h("ul", {}, ...dr.milestones.map((m) => h("li", {}, `${m.title} — ${m.durationDays}d, ${m.percentOfBudget}%: ${m.description}`))),
    h("h3", {}, "Ask the client"),
    h("ul", {}, ...dr.clientQuestions.map((q) => h("li", {}, q))),
    h("div", { class: "must" },
      h("h3", {}, "What you still must do"),
      h("ul", {}, ...dr.youStillMust.map((q) => h("li", {}, q))),
    ),
  );
}

function pageTab(): HTMLElement {
  const wrap = h("div", {});
  wrap.append(
    h("div", { class: "row" },
      h("button", { class: "btn", type: "button", disabled: st.scanning, onClick: () => void runScan() }, st.scanning ? h("span", { class: "spin" }) : null, st.scanning ? "Scanning\u2026" : "Scan this page"),
      h("span", { class: "note" }, "Reads the listings on the tab you have open."),
    ),
  );
  if (st.scanError) wrap.append(h("div", { class: "err", role: "alert" }, st.scanError));
  const s = st.scan;
  if (s) {
    if (s.found === 0) wrap.append(h("p", { class: "note" }, s.note ?? "No listings found on this page."));
    else {
      const q = s.result?.quota;
      wrap.append(h("p", { class: "note" },
        `Found ${s.found} listing${s.found === 1 ? "" : "s"} (${s.parser} parser). `,
        q && q.limit !== null ? `Free matches left this week: ${q.remaining}/${q.limit}. ` : "",
        s.note ?? "",
      ));
      for (const item of s.result?.items ?? []) wrap.append(resultCard(item));
    }
  }
  if (st.draft) wrap.append(draftView(st.draft));
  return wrap;
}

function topTab(): HTMLElement {
  const wrap = h("div", {});
  if (st.matchesError) wrap.append(h("div", { class: "err" }, st.matchesError));
  if (!st.matches) {
    if (!st.matchesError) wrap.append(h("p", { class: "note" }, h("span", { class: "spin" }), "Loading your best matches…"));
    return wrap;
  }
  if (!st.matches.matches.length) wrap.append(h("p", {}, "No matches scored 45+ yet. Scan a listings page to get started."));
  for (const m of st.matches.matches) {
    wrap.append(h("div", { class: "card" },
      h("div", { class: "head" },
        scoreBadge({ score: m.score, label: m.label }),
        h("div", {}, h("div", { class: "title" }, m.job.title), h("div", { class: "sum" }, m.summary), h("div", { class: "note" }, [m.job.source, m.job.budgetText].filter(Boolean).join(" · "))),
      ),
      h("div", { class: "actions" },
        canDraft() ? h("button", { class: "btn small", type: "button", disabled: st.draftingId !== null, onClick: () => void draftFor(m.id, m.job.title) }, st.draftingId === m.id ? "Drafting…" : "Draft proposal") : null,
        h("button", { class: "btn small ghost", type: "button", onClick: () => openUrl(m.job.url) }, "Open listing"),
        h("button", { class: "btn small ghost", type: "button", onClick: () => openUrl(`${st.apiBase}/dashboard/matches/${encodeURIComponent(m.id)}`) }, "Details"),
      ),
      st.draftError && st.draftError.matchId === m.id ? h("div", { class: "err" }, st.draftError.message) : null,
    ));
  }
  if (st.draft) wrap.append(draftView(st.draft));
  return wrap;
}

function mainView(): HTMLElement {
  const wrap = h("div", {});
  const mk = (id: State["tab"], label: string) =>
    h("button", {
      class: "tab", type: "button", role: "tab", "aria-selected": String(st.tab === id),
      onClick: () => {
        st.tab = id;
        if (id === "top") void loadMatches();
        render();
      },
    }, label);
  wrap.append(h("div", { class: "tabs", role: "tablist" }, mk("page", "This page"), mk("top", "Top matches")));
  if (st.notice) wrap.append(h("div", { class: "note ok", role: "status" }, st.notice));
  wrap.append(st.tab === "page" ? pageTab() : topTab());
  if (st.me) {
    wrap.append(h("div", { class: "row note" },
      h("span", {}, st.me.user.email),
      h("button", { class: "link", type: "button", onClick: () => openUrl(`${st.apiBase}/dashboard`) }, "Open dashboard"),
    ));
  }
  return wrap;
}

function setupView(): HTMLElement {
  const key = h("input", { type: "password", id: "key", placeholder: "gr_…", autocomplete: "off", "aria-describedby": "key-help" });
  (key as HTMLInputElement).spellcheck = false;
  const base = h("input", { type: "url", id: "base", value: st.apiBase, autocomplete: "off" });
  const auto = h("input", { type: "checkbox", id: "auto", checked: st.autoScan });
  const form = h("form", {
    onSubmit: (e: Event) => {
      e.preventDefault();
      void saveAndConnect((key as HTMLInputElement).value, (base as HTMLInputElement).value, (auto as HTMLInputElement).checked);
    },
  },
    h("h2", {}, "Connect your GigRadar account"),
    h("p", {}, "Paste the license key from your dashboard (Billing → License key). It lets this extension score listings and draft proposals for you. It stays in this browser."),
    h("label", { for: "key" }, "License key"), key,
    h("div", { id: "key-help", class: "note" }, "Don't have one yet? ", h("button", { class: "link", type: "button", onClick: () => openUrl(`${st.apiBase}/signup`) }, "Create a free account"), "."),
    h("label", { for: "base" }, "GigRadar address"), base,
    h("label", { class: "check", for: "auto" }, auto, h("span", {}, "Scan listing pages automatically when they open (supported boards only). Off by default \u2014 otherwise GigRadar reads a page only when you press Scan.")),
    st.settingsError ? h("div", { class: "err", role: "alert" }, st.settingsError) : null,
    h("div", { class: "row", style: "margin-top:12px" },
      h("button", { class: "btn", type: "submit", disabled: st.busy }, st.busy ? "Connecting…" : "Save & connect"),
      st.me ? h("button", { class: "btn ghost", type: "button", onClick: () => { st.view = "main"; render(); } }, "Cancel") : null,
    ),
  );
  return form;
}

function render() {
  planChip.hidden = !st.me;
  if (st.me) {
    planChip.textContent = st.me.plan;
    planChip.className = `chip ${st.me.plan}`;
  }
  app.replaceChildren(st.view === "setup" ? setupView() : mainView());
}

document.getElementById("settings-btn")?.addEventListener("click", () => {
  st.view = st.view === "setup" ? "main" : "setup";
  st.settingsError = null;
  render();
});

void connect();
