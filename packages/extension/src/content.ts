import { clearBadges, renderBadges } from "./overlay";
import { parsePage } from "./parsers";
import { findProposalField, prefillProposal } from "./prefill";
import { getSettings } from "./settings";
import type { BgResponse, IngestResult, ParsedJob, PrefillResponse, ScanResponse, TabRequest } from "./types";

/**
 * Content script. Reads the page the user has open — only when they press "Scan" in the popup (or have turned on
 * auto-scan, which is off by default) — and never navigates, clicks, or submits anything.
 */

declare global {
  interface Window {
    __gigradarLoaded?: boolean;
  }
}

const MAX_JOBS = 50;

/** Trim to the API's field limits so one over-long listing can't make the whole batch fail validation. */
function fit(job: ParsedJob): ParsedJob {
  return {
    ...job,
    title: job.title.slice(0, 300),
    description: job.description.slice(0, 7900),
    url: job.url.slice(0, 2000),
    skills: job.skills.map((s) => s.slice(0, 60)).slice(0, 40),
  };
}

function callBackground<T>(message: unknown): Promise<BgResponse<T>> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res: BgResponse<T> | undefined) => {
        if (chrome.runtime.lastError || !res) {
          resolve({ ok: false, error: { status: 0, code: "no_background", message: chrome.runtime.lastError?.message ?? "No response from the extension. Reload the page and try again." } });
        } else resolve(res);
      });
    } catch (err) {
      resolve({ ok: false, error: { status: 0, code: "context_invalidated", message: "The extension was updated or reloaded. Refresh this page." } });
    }
  });
}

async function scan(): Promise<ScanResponse> {
  const page = parsePage(document, new URL(location.href));
  const hasProposalForm = findProposalField() !== null;
  if (!page) {
    return { ok: true, parser: "none", page: "unknown", found: 0, result: null, hasProposalForm, note: "No job listings recognised on this page. GigRadar reads fixture boards and, best-effort, listing pages that expose structured data." };
  }
  const jobs = page.jobs.slice(0, MAX_JOBS).map(fit);
  const res = await callBackground<IngestResult>({ type: "GR_INGEST", jobs });
  if (!res.ok) return { ok: false, error: res.error.message, code: res.error.code };
  renderBadges(page.elements.slice(0, MAX_JOBS), res.data.items);
  const note = page.jobs.length > MAX_JOBS ? `Scanned the first ${MAX_JOBS} of ${page.jobs.length} listings.` : undefined;
  return { ok: true, parser: page.parser, page: page.page, found: jobs.length, result: res.data, hasProposalForm, note };
}

if (!window.__gigradarLoaded) {
  window.__gigradarLoaded = true;

  chrome.runtime.onMessage.addListener((msg: TabRequest, sender, sendResponse: (r: unknown) => void) => {
    if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== "string") return false;
    if (msg.type === "GR_PING") {
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === "GR_SCAN") {
      scan()
        .then(sendResponse)
        .catch((err: unknown) => sendResponse({ ok: false, error: (err as Error)?.message ?? "Scan failed" } satisfies ScanResponse));
      return true;
    }
    if (msg.type === "GR_PREFILL") {
      const r: PrefillResponse = typeof msg.text === "string" && msg.text.trim() ? prefillProposal(msg.text) : { ok: false, error: "Nothing to fill." };
      sendResponse(r);
      return false;
    }
    return false;
  });

  // Opt-in only. Default is off: the extension acts when the user asks.
  void getSettings()
    .then((s) => {
      if (s.autoScan && s.licenseKey) setTimeout(() => void scan(), 1200);
    })
    .catch(() => undefined);
}

export { clearBadges };
