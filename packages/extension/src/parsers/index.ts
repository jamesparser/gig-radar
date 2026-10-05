import type { BoardParser, ParsedPage } from "../types";
import { fiverrParser } from "./fiverr";
import { fixtureParser } from "./fixture";
import { freelancerParser } from "./freelancer";
import { jsonLdParser } from "./jsonld";
import { upworkParser } from "./upwork";

/** Order matters: the first parser that matches AND finds listings wins. JSON-LD is the generic fallback for any other board. */
export const PARSERS: BoardParser[] = [fixtureParser, upworkParser, freelancerParser, fiverrParser, jsonLdParser];

export function parsePage(doc: Document, url: URL): ParsedPage | null {
  for (const p of PARSERS) {
    if (!p.matches(url, doc)) continue;
    try {
      const r = p.parse(doc, url);
      if (r.jobs.length) return r;
    } catch (err) {
      console.warn(`[GigRadar] parser ${p.id} failed`, err);
    }
  }
  return null;
}
