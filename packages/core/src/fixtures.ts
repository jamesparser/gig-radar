import type { JobInput, ProfileInput } from "./schemas";

/**
 * FIXTURE DATA — fictional listings and a fictional freelancer, used for:
 *   • the "Load sample jobs" button (demo without scraping anything),
 *   • the fixture job board at /demo-board that the Chrome extension can read,
 *   • tests.
 * None of this is real marketplace data. Every fixture is labelled `source: "fixture"`.
 */

export interface FixtureJob extends Omit<JobInput, "url" | "postedAt" | "source"> {
  id: string;
  /** Minutes before "now" the listing was posted — keeps the demo looking fresh. */
  postedMinutesAgo: number;
}

export const FIXTURE_PROFILE: ProfileInput = {
  headline: "Full-stack TypeScript engineer — SaaS, billing and AI integrations",
  bio: "I build and ship SaaS products end to end with TypeScript, React and Node. I focus on billing flows, developer tools and LLM-powered features, and I like small, reviewable milestones. [Sample profile for demos — replace with your own.]",
  skills: [
    "TypeScript",
    "React",
    "Next.js",
    "Node.js",
    "PostgreSQL",
    "Stripe",
    "Tailwind",
    "Python",
    "LLM",
    "Chrome extensions",
    "Web scraping",
    "SEO",
    "API",
  ],
  niches: ["SaaS", "crypto", "fintech", "developer tools"],
  excludeKeywords: ["unpaid", "trial task", "free sample"],
  hourlyRateFloor: 55,
  minFixedBudget: 800,
  timezone: "UTC",
  portfolioLinks: [],
  tone: "professional",
};

export const FIXTURE_JOBS: FixtureJob[] = [
  {
    id: "fx-1001",
    title: "Rebuild our SaaS analytics dashboard in Next.js + TypeScript",
    description:
      "We run a B2B analytics product and our dashboard is a jQuery-era mess. We want it rebuilt in Next.js (App Router) with TypeScript, Tailwind and a clean component library. Data comes from a PostgreSQL warehouse through a small REST API that already exists. You'll own the front-end: charts, filters, saved views and CSV export. We'd like weekly demos and small pull requests. Bonus if you've shipped billing or usage-metering screens before.",
    budget: { type: "hourly", min: 55, max: 80, currency: "USD" },
    skills: ["Next.js", "TypeScript", "React", "Tailwind", "PostgreSQL"],
    client: { paymentVerified: true, rating: 4.9, totalSpent: 42000, hireRate: 0.7, country: "United States", proposals: 4 },
    postedMinutesAgo: 25,
  },
  {
    id: "fx-1002",
    title: "Stripe subscriptions + license-key gating for a Chrome extension",
    description:
      "Our Chrome extension (MV3) is free today and we want to add paid plans. Needed: Stripe Checkout for two monthly tiers, a webhook that creates a license key, an API endpoint the extension calls to validate the key, and a simple customer portal link. Node.js backend with PostgreSQL. We have a rough spec and a staging environment. Test-mode walkthrough video at the end please.",
    budget: { type: "fixed", min: 1800, max: 2500, currency: "USD" },
    skills: ["Stripe", "Node.js", "PostgreSQL", "API", "Chrome extensions"],
    client: { paymentVerified: true, rating: 4.7, totalSpent: 8200, hireRate: 0.5, country: "Canada", proposals: 9 },
    postedMinutesAgo: 190,
  },
  {
    id: "fx-1003",
    title: "WordPress landing page for a dental clinic",
    description:
      "Small clinic needs a one-page WordPress site with Elementor: hero, services, opening hours, contact form. Content will be provided. Looking for someone fast and cheap. Please include a free sample of your work with your proposal.",
    budget: { type: "fixed", min: 150, max: 300, currency: "USD" },
    skills: ["WordPress", "Elementor", "PHP"],
    client: { paymentVerified: false, totalSpent: 0, proposals: 38, country: "Australia" },
    postedMinutesAgo: 1230,
  },
  {
    id: "fx-1004",
    title: "LLM-powered support-ticket triage service (Python / FastAPI)",
    description:
      "We get ~2,000 support tickets a week and want an internal service that classifies them, extracts the key fields, drafts a first reply and routes to the right queue. Python + FastAPI, PostgreSQL for storage, and an LLM API of your choice (we're open to OpenAI or Anthropic). We care about evaluation: a small labelled set and a way to measure accuracy. Human agents stay in the loop — nothing is sent automatically.",
    budget: { type: "hourly", min: 60, max: 90, currency: "USD" },
    skills: ["Python", "FastAPI", "LLM", "OpenAI", "PostgreSQL"],
    client: { paymentVerified: true, rating: 4.8, totalSpent: 5200, hireRate: 0.4, country: "United Kingdom", proposals: 11 },
    postedMinutesAgo: 360,
  },
  {
    id: "fx-1005",
    title: "Scrape and normalise 50 real-estate listing sites into Postgres",
    description:
      "We need a robust scraping pipeline for 50 public real-estate listing sites (robots.txt respected), normalised into a common PostgreSQL schema with de-duplication and daily refresh. Python preferred (Playwright or Scrapy). Deliverables: the pipeline, a schema doc, monitoring for broken parsers, and a runbook.",
    budget: { type: "fixed", min: 900, max: 1400, currency: "USD" },
    skills: ["Python", "Web scraping", "PostgreSQL", "ETL"],
    client: { paymentVerified: true, rating: 4.2, totalSpent: 900, hireRate: 0.3, country: "Germany", proposals: 14 },
    postedMinutesAgo: 1800,
  },
  {
    id: "fx-1006",
    title: "3D artist and animator for a Unity mobile game",
    description:
      "Looking for a stylised 3D artist to produce 12 characters and basic walk/run/idle animations for our Unity mobile game. Experience with Blender and Unity importing required. C# knowledge is a plus but not essential.",
    budget: { type: "hourly", min: 15, max: 25, currency: "USD" },
    skills: ["Unity", "Blender", "3D Modeling", "Animation", "C#"],
    client: { paymentVerified: true, rating: 4.0, totalSpent: 2100, hireRate: 0.2, country: "Spain", proposals: 27 },
    postedMinutesAgo: 600,
  },
  {
    id: "fx-1007",
    title: "Technical SEO audit + programmatic pages for a crypto data site",
    description:
      "We run a crypto market-data site on Next.js and Cloudflare and want to grow organic traffic. Scope: technical SEO audit (crawl, indexation, Core Web Vitals), a programmatic page strategy for coin and exchange pages, structured data, and an internal-linking plan. You should be comfortable reading Next.js code and shipping the fixes yourself. Crypto familiarity strongly preferred.",
    budget: { type: "fixed", min: 1200, max: 2000, currency: "USD" },
    skills: ["SEO", "Next.js", "Cloudflare", "Crypto"],
    client: { paymentVerified: true, rating: 4.6, totalSpent: 15000, hireRate: 0.6, country: "Singapore", proposals: 7 },
    postedMinutesAgo: 95,
  },
  {
    id: "fx-1008",
    title: "Senior Node.js engineer — API performance and Redis caching",
    description:
      "Our Node.js API (Express, PostgreSQL, AWS) is slowing down under load. We need a senior engineer to profile hot paths, add a Redis caching layer, fix N+1 queries and set up load tests. Ongoing relationship likely if it goes well. Must overlap with US Eastern hours for a few hours a day.",
    budget: { type: "hourly", min: 70, max: 100, currency: "USD" },
    skills: ["Node.js", "Redis", "PostgreSQL", "AWS", "API"],
    client: { paymentVerified: true, rating: 5.0, totalSpent: 120000, hireRate: 0.8, country: "United States", proposals: 22 },
    postedMinutesAgo: 3000,
  },
  {
    id: "fx-1009",
    title: "Chrome extension (MV3) for tab-group productivity",
    description:
      "Build a small MV3 Chrome extension that saves and restores tab groups, with keyboard shortcuts and a popup UI. TypeScript preferred, no backend required in v1. We'll publish it to the Chrome Web Store and need help with the review process.",
    budget: { type: "fixed", min: 700, max: 1100, currency: "USD" },
    skills: ["JavaScript", "TypeScript", "Chrome extensions"],
    client: { paymentVerified: true, rating: 4.5, totalSpent: 3000, hireRate: 0.5, country: "Netherlands", proposals: 6 },
    postedMinutesAgo: 300,
  },
  {
    id: "fx-1010",
    title: "Logo for a coffee brand — unpaid trial task first",
    description:
      "Need a logo for our new coffee brand. To choose a designer we ask every applicant to complete an unpaid trial task: submit a full logo concept in 24 hours. The winner gets the paid project.",
    budget: { type: "fixed", min: 25, max: 40, currency: "USD" },
    skills: ["Logo Design", "Illustrator"],
    client: { paymentVerified: false, proposals: 61, country: "India" },
    postedMinutesAgo: 120,
  },
  {
    id: "fx-1011",
    title: "Fix wallet-connect flow in our React dApp front-end",
    description:
      "Our React + TypeScript dApp front-end has a flaky wallet-connect flow (WalletConnect, injected wallets) and a few state bugs after network switches. Looking for a developer who has shipped web3 front-ends and can debug quickly. Small fixes, then maybe ongoing work.",
    budget: { type: "hourly", min: 50, max: 75, currency: "USD" },
    skills: ["React", "TypeScript", "Web3", "Solidity"],
    client: { paymentVerified: true, rating: 4.4, totalSpent: 6400, hireRate: 0.45, country: "United Arab Emirates", proposals: 12 },
    postedMinutesAgo: 45,
  },
];

export function fixtureJobInputs(baseUrl: string, now: Date = new Date()): JobInput[] {
  const base = baseUrl.replace(/\/$/, "");
  return FIXTURE_JOBS.map((f) => {
    const { id, postedMinutesAgo, ...rest } = f;
    return {
      ...rest,
      source: "fixture" as const,
      externalId: id,
      url: `${base}/demo-board/jobs/${id}`,
      postedAt: new Date(now.getTime() - postedMinutesAgo * 60_000).toISOString(),
    };
  });
}
