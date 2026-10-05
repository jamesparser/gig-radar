import { makeBoardParser, type BoardConfig } from "./board";

/** Freelancer.com — BEST-EFFORT, UNVERIFIED selectors (see board.ts). */
export const freelancerConfig: BoardConfig = {
  id: "freelancer",
  label: "Freelancer",
  hosts: /(^|\.)freelancer\.[a-z.]+$/i,
  detailUrl: /\/projects\/[^/]+\/[^/]+/i,
  card: [".JobSearchCard-item", '[data-test="project-card"]', "fl-project-card"],
  detailRoot: [".PageProjectViewLogout-main", '[data-test="project-details"]', "main"],
  title: [".JobSearchCard-primary-heading-link", '[data-test="project-title"]', ".PageProjectViewLogout-header-title", "h1", "h2 a"],
  link: [".JobSearchCard-primary-heading-link", "h2 a", "a[href*='/projects/']"],
  description: [".JobSearchCard-primary-description", '[data-test="project-description"]', ".PageProjectViewLogout-detail"],
  budget: [".JobSearchCard-secondary-price", '[data-test="project-budget"]', ".PageProjectViewLogout-header-byLine"],
  skills: [".JobSearchCard-primary-tags a", '[data-test="skill-tag"]', ".PageProjectViewLogout-detail-tags a"],
  posted: [".JobSearchCard-primary-heading-days", '[data-test="posted-time"]'],
  proposals: [".JobSearchCard-secondary-entry", '[data-test="bid-count"]'],
  client: { verified: ['[data-test="payment-verified"]', ".verified-payment"], unverified: [], spent: [], rating: [], country: ['[data-test="client-country"]'] },
};

export const freelancerParser = makeBoardParser(freelancerConfig);
