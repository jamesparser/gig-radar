import type { Settings } from "./types";

declare const __API_BASE__: string;

export const DEFAULT_API_BASE: string = typeof __API_BASE__ === "string" ? __API_BASE__ : "http://localhost:3000";

const DEFAULTS: Settings = { apiBase: DEFAULT_API_BASE, licenseKey: "", autoScan: false };

export async function getSettings(): Promise<Settings> {
  const s = (await chrome.storage.local.get(["apiBase", "licenseKey", "autoScan"])) as Partial<Settings>;
  return { apiBase: (s.apiBase || DEFAULTS.apiBase).replace(/\/$/, ""), licenseKey: s.licenseKey ?? "", autoScan: s.autoScan ?? false };
}

export async function saveSettings(s: Partial<Settings>): Promise<void> {
  const clean: Partial<Settings> = { ...s };
  if (clean.apiBase !== undefined) clean.apiBase = clean.apiBase.trim().replace(/\/$/, "");
  if (clean.licenseKey !== undefined) clean.licenseKey = clean.licenseKey.trim();
  await chrome.storage.local.set(clean);
}
