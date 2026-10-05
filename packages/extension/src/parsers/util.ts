import type { Budget } from "../types";

export const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

export function abs(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function first<T extends Element>(root: ParentNode, selectors: string[]): T | null {
  for (const s of selectors) {
    const el = root.querySelector<T>(s);
    if (el) return el;
  }
  return null;
}

export function all<T extends Element>(root: ParentNode, selectors: string[]): T[] {
  for (const s of selectors) {
    const list = Array.from(root.querySelectorAll<T>(s));
    if (list.length) return list;
  }
  return [];
}

/** "$1,200" → 1200, "$40K+" → 40000, "1.5M" → 1500000. */
export function parseMoney(raw: string): number | undefined {
  const m = /(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?/.exec(raw);
  if (!m) return undefined;
  let n = Number(m[1]!.replace(/,/g, ""));
  if (Number.isNaN(n)) return undefined;
  const suffix = m[2]?.toLowerCase();
  if (suffix === "k") n *= 1_000;
  if (suffix === "m") n *= 1_000_000;
  return n;
}

const CURRENCY: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP", "₹": "INR", "A$": "AUD", "C$": "CAD" };

/**
 * Parse budget text from any board: "$30.00 - $60.00", "Hourly: $25-$50", "Fixed price: $1,200",
 * "Est. Budget: $500", "€250 EUR". Returns {type:"unknown"} when nothing money-like is present.
 */
export function parseBudgetText(raw: string): Budget {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return { type: "unknown", currency: "USD" };
  const hourly = /\/\s*(hr|hour)\b|per hour|hourly/i.test(t);
  const sym = /(A\$|C\$|[$€£₹])/.exec(t)?.[1];
  const code = /\b(USD|EUR|GBP|INR|AUD|CAD)\b/.exec(t)?.[1];
  const currency = code ?? (sym ? CURRENCY[sym] : undefined) ?? "USD";
  const nums = [...t.matchAll(/(?:A\$|C\$|[$€£₹])\s?(\d[\d,]*(?:\.\d+)?\s?[kKmM]?)/g)].map((m) => parseMoney(m[1]!)).filter((n): n is number => n !== undefined);
  const bare = nums.length ? nums : [...t.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\b/g)].map((m) => parseMoney(m[1]!)).filter((n): n is number => n !== undefined && n >= 5);
  if (!bare.length) return { type: "unknown", currency };
  const min = Math.min(...bare);
  const max = Math.max(...bare);
  return { type: hourly ? "hourly" : "fixed", min, max, currency };
}

export function parseAgo(raw: string, now = Date.now()): string | undefined {
  const t = raw.toLowerCase();
  if (/just now|moments? ago/.test(t)) return new Date(now).toISOString();
  if (/\byesterday\b/.test(t)) return new Date(now - 86_400_000).toISOString();
  const m = /(\d+|an?|one)\s*(second|minute|min|hour|hr|day|week|month)s?\s*ago/.exec(t);
  if (!m) return undefined;
  const n = /^(an?|one)$/.test(m[1]!) ? 1 : Number(m[1]);
  const unit = m[2]!;
  const ms = unit.startsWith("sec") ? 1_000 : unit.startsWith("min") ? 60_000 : unit.startsWith("h") ? 3_600_000 : unit.startsWith("d") ? 86_400_000 : unit.startsWith("w") ? 604_800_000 : 2_592_000_000;
  return new Date(now - n * ms).toISOString();
}

/** Boards show proposal counts as ranges: "Less than 5", "5 to 10", "20 to 50", "50+". */
export function parseProposals(raw: string): number | undefined {
  const t = raw.toLowerCase();
  if (/less than\s*(\d+)/.test(t)) return Math.max(0, Math.round(Number(/less than\s*(\d+)/.exec(t)![1]) / 2));
  const r = /(\d+)\s*(?:to|-|–)\s*(\d+)/.exec(t);
  if (r) return Math.round((Number(r[1]) + Number(r[2])) / 2);
  const p = /(\d+)\s*\+/.exec(t);
  if (p) return Number(p[1]);
  const n = /(\d+)/.exec(t);
  return n ? Number(n[1]) : undefined;
}

export function stableId(url: string): string | undefined {
  try {
    const u = new URL(url);
    const m = /(~?[0-9a-f]{12,}|\d{5,})/i.exec(u.pathname);
    return m?.[1];
  } catch {
    return undefined;
  }
}

export function uniqueByUrl<T extends { url: string }>(jobs: T[], elements: (Element | null)[]): { jobs: T[]; elements: (Element | null)[] } {
  const seen = new Set<string>();
  const outJ: T[] = [];
  const outE: (Element | null)[] = [];
  jobs.forEach((j, i) => {
    if (seen.has(j.url)) return;
    seen.add(j.url);
    outJ.push(j);
    outE.push(elements[i] ?? null);
  });
  return { jobs: outJ, elements: outE };
}
