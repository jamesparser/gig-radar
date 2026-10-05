import { makeBoardParser, type BoardConfig } from "./board";

/** Upwork — BEST-EFFORT, UNVERIFIED selectors (see board.ts). Tune against the live DOM if you use this on the real site. */
export const upworkConfig: BoardConfig = {
  id: "upwork",
  label: "Upwork",
  hosts: /(^|\.)upwork\.com$/i,
  detailUrl: /\/(jobs\/[^/]*~[0-9a-f]+|freelance-jobs\/apply\/)/i,
  card: ['article[data-test="JobTile"]', 'section[data-test="JobTile"]', '[data-test="job-tile-list"] > section', "article.job-tile"],
  detailRoot: ['[data-test="job-details"]', "main", "#main"],
  title: ['[data-test="job-title-link"]', "h2 a", "h3 a", "h4 a", "h1"],
  link: ['a[data-test="job-title-link"]', "h2 a", "h3 a", "h4 a"],
  description: ['[data-test="job-description-text"]', '[data-test="UpCLineClamp JobDescription"]', '[data-test="Description"]', ".job-description"],
  budget: ['[data-test="job-type-label"]', '[data-test="is-fixed-price"]', '[data-test="budget"]', '[data-test="BudgetAmount"]', '[data-test="job-type"]'],
  skills: ['[data-test="token"]', ".air3-token", '[data-test="Skill"]', '[data-test="attr-item"]'],
  posted: ['[data-test="posted-on"]', '[data-test="job-pubilshed-date"]', "time"],
  proposals: ['[data-test="proposals-tier"]', '[data-test="proposals"]'],
  client: {
    verified: ['[data-test="payment-verified"]', ".payment-verified"],
    unverified: ['[data-test="payment-unverified"]', ".payment-unverified"],
    spent: ['[data-test="client-spendings"]', '[data-test="total-spent"]'],
    rating: [".air3-rating-value-text", '[data-test="client-rating"]'],
    country: ['[data-test="client-country"]', '[data-test="location"]'],
  },
};

export const upworkParser = makeBoardParser(upworkConfig);
