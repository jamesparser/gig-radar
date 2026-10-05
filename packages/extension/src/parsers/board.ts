import type { BoardParser, ClientSignals, ParsedJob, ParsedPage, Source } from "../types";
import { abs, all, first, parseAgo, parseBudgetText, parseMoney, parseProposals, stableId, text, uniqueByUrl } from "./util";

/**
 * Config-driven parser for real marketplaces.
 *
 * HONESTY NOTE — read before relying on this: marketplace markup changes often and is not documented. The selector
 * lists below are best-effort guesses, UNVERIFIED against the live sites, and live scraping may also be blocked or
 * restricted by each site's terms. The supported demo path is the fixture board (parsers/fixture.ts); real-board support
 * is "implement/tune a BoardConfig". Absence of a client signal is reported as `undefined` (unknown), never `false`.
 */
export interface BoardConfig {
  id: Source;
  label: string;
  hosts: RegExp;
  /** URL paths that are a single-listing page. */
  detailUrl: RegExp;
  /** URL paths that are a list of listings (optional; list parsing also runs whenever cards are found). */
  listUrl?: RegExp;
  card: string[];
  detailRoot: string[];
  title: string[];
  link: string[];
  description: string[];
  budget: string[];
  skills: string[];
  posted: string[];
  proposals: string[];
  client: { verified: string[]; unverified: string[]; spent: string[]; rating: string[]; country: string[] };
}

function extract(root: ParentNode, cfg: BoardConfig, pageUrl: URL, isCard: boolean): ParsedJob | null {
  const titleEl = first<HTMLElement>(root, cfg.title);
  const title = text(titleEl);
  if (!title) return null;

  const linkEl = first<HTMLAnchorElement>(root, cfg.link) ?? (titleEl?.closest("a") as HTMLAnchorElement | null) ?? (titleEl?.querySelector("a") as HTMLAnchorElement | null);
  const url = (isCard ? abs(linkEl?.getAttribute("href"), pageUrl.href) : null) ?? pageUrl.href;

  const descEl = first(root, cfg.description);
  const rootText = text(root as Element);
  const description = (text(descEl) || (isCard ? rootText : "")).slice(0, 8000);

  const budgetText = text(first(root, cfg.budget)) || rootText.slice(0, 500);
  const budget = parseBudgetText(budgetText);

  const skills = Array.from(new Set(all(root, cfg.skills).map((s) => text(s)).filter((s) => s && s.length <= 40))).slice(0, 30);

  const c = cfg.client;
  const client: ClientSignals = {};
  if (first(root, c.unverified)) client.paymentVerified = false;
  else if (first(root, c.verified)) client.paymentVerified = true;
  const spent = parseMoney(text(first(root, c.spent)));
  if (spent !== undefined) client.totalSpent = spent;
  const rating = Number(/(\d(?:\.\d+)?)/.exec(text(first(root, c.rating)))?.[1]);
  if (Number.isFinite(rating) && rating > 0 && rating <= 5) client.rating = rating;
  const country = text(first(root, c.country));
  if (country && country.length < 60) client.country = country;
  const proposals = parseProposals(text(first(root, cfg.proposals)));
  if (proposals !== undefined) client.proposals = proposals;

  return {
    source: cfg.id,
    externalId: stableId(url),
    url,
    title,
    description,
    budget,
    skills,
    client,
    postedAt: parseAgo(text(first(root, cfg.posted))),
  };
}

export function makeBoardParser(cfg: BoardConfig): BoardParser {
  return {
    id: cfg.id,
    label: cfg.label,
    matches: (url) => cfg.hosts.test(url.hostname),
    parse(doc, url): ParsedPage {
      const onDetail = cfg.detailUrl.test(url.pathname);
      const cards = onDetail ? [] : all<HTMLElement>(doc, cfg.card);
      if (cards.length) {
        const jobs: ParsedJob[] = [];
        const els: (Element | null)[] = [];
        for (const card of cards) {
          const j = extract(card, cfg, url, true);
          if (j) {
            jobs.push(j);
            els.push(card);
          }
        }
        const u = uniqueByUrl(jobs, els);
        return { parser: cfg.id, page: "list", jobs: u.jobs, elements: u.elements };
      }
      const root = first<HTMLElement>(doc, cfg.detailRoot) ?? doc.body;
      const j = extract(root, cfg, url, false);
      return j ? { parser: cfg.id, page: "detail", jobs: [j], elements: [root] } : { parser: cfg.id, page: "unknown", jobs: [], elements: [] };
    },
  };
}
