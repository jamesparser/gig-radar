import { getSettings } from "./settings";
import type { BgRequest, BgResponse } from "./types";

/**
 * Service worker. The ONLY place that talks to the GigRadar API: content scripts and the popup send messages here,
 * so the license key never touches a marketplace page and marketplace pages cannot read it.
 */

const TIMEOUT_MS = 60_000;

class ApiFailure extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { apiBase, licenseKey } = await getSettings();
  if (!licenseKey) throw new ApiFailure(401, "no_license", "Add your GigRadar license key in the extension popup first.");
  let res: Response;
  try {
    res = await fetch(`${apiBase}/api${path}`, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", "x-gigradar-license": licenseKey },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      credentials: "omit",
    });
  } catch (err) {
    const timedOut = (err as Error).name === "TimeoutError";
    throw new ApiFailure(0, timedOut ? "timeout" : "network", timedOut ? "GigRadar took too long to respond." : `Could not reach ${apiBase}. Check the API URL in the popup and that you have allowed access to it.`);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiFailure(res.status, e?.code ?? `http_${res.status}`, e?.message ?? `GigRadar returned HTTP ${res.status}.`);
  }
  return data as T;
}

async function handle(msg: BgRequest): Promise<unknown> {
  switch (msg.type) {
    case "GR_ME":
      return api("/me");
    case "GR_INGEST":
      // Server cap is 50 per request; the content script already caps, this is belt and braces.
      return api("/jobs", { method: "POST", body: { jobs: msg.jobs.slice(0, 50) } });
    case "GR_DRAFT": {
      const r = await api<{ draft: unknown }>(`/matches/${encodeURIComponent(msg.matchId)}/draft`, { method: "POST", body: {} });
      return r.draft;
    }
    case "GR_MATCHES":
      return api("/matches?limit=15&minScore=45");
  }
}

chrome.runtime.onMessage.addListener((msg: BgRequest, sender, sendResponse: (r: BgResponse) => void) => {
  // Only our own extension pages and content scripts may use the API bridge.
  if (sender.id !== chrome.runtime.id || !msg || typeof (msg as { type?: unknown }).type !== "string") return false;
  handle(msg)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err: unknown) => {
      const e = err instanceof ApiFailure ? err : new ApiFailure(0, "unexpected", (err as Error)?.message ?? "Unexpected error");
      sendResponse({ ok: false, error: { status: e.status, code: e.code, message: e.message } });
    });
  return true; // async response
});
