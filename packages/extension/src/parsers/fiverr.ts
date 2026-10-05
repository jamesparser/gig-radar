import { makeBoardParser, type BoardConfig } from "./board";

/**
 * Fiverr — the LEAST certain of the three. Fiverr is primarily a services marketplace; buyer-request style listings
 * sit behind a seller login and their markup is undocumented. These selectors are guesses (see board.ts); expect to tune them.
 */
export const fiverrConfig: BoardConfig = {
  id: "fiverr",
  label: "Fiverr",
  hosts: /(^|\.)fiverr\.com$/i,
  detailUrl: /\/(requests|briefs)\/\d+/i,
  card: ['[data-testid="buyer-request"]', '[class*="buyer-request"]', 'li[class*="request"]'],
  detailRoot: ['[data-testid="request-details"]', "main"],
  title: ['[data-testid="request-title"]', "h3", "h2", "h1"],
  link: ["a[href*='/requests/']", "a[href*='/briefs/']", "h3 a", "h2 a"],
  description: ['[data-testid="request-description"]', "p"],
  budget: ['[data-testid="request-budget"]', '[class*="budget"]'],
  skills: ['[data-testid="request-category"]', '[class*="tag"]'],
  posted: ["time", '[class*="posted"]'],
  proposals: ['[class*="offers"]'],
  client: { verified: [], unverified: [], spent: [], rating: [], country: [] },
};

export const fiverrParser = makeBoardParser(fiverrConfig);
