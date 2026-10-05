import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePage } from "../src/parsers";
import { findProposalField, prefillProposal } from "../src/prefill";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const docOf = (html: string) => new DOMParser().parseFromString(html, "text/html");

/**
 * board-list.html / board-detail.html are real captures of the app's own /demo-board (the supported fixture path).
 * The Upwork/Freelancer/Fiverr cases below use SYNTHETIC markup written to the configured selectors: they prove the
 * parser mechanics, NOT that the selectors match the live sites (they are unverified — see parsers/board.ts).
 */
describe("fixture board parser (captured from /demo-board)", () => {
  const url = new URL("https://gigradar.example/demo-board");

  it("finds all 11 fictional listings with structured fields", () => {
    const page = parsePage(docOf(fixture("board-list.html")), url);
    expect(page?.parser).toBe("fixture");
    expect(page?.page).toBe("list");
    expect(page?.jobs).toHaveLength(11);
    expect(page?.elements.every(Boolean)).toBe(true);

    const first = page!.jobs[0]!;
    expect(first.source).toBe("fixture");
    expect(first.externalId).toBe("fx-1001");
    expect(first.title.length).toBeGreaterThan(5);
    expect(first.url).toMatch(/^https:\/\/gigradar\.example\/demo-board\/jobs\/fx-1001$/);
    expect(first.skills.length).toBeGreaterThan(1);
    expect(first.budget.type === "fixed" || first.budget.type === "hourly").toBe(true);
    expect(first.budget.max ?? first.budget.min).toBeGreaterThan(0);
    expect(first.description.length).toBeGreaterThan(40);
  });

  it("reads client signals as unknown (undefined) when the page doesn't state them", () => {
    const page = parsePage(docOf(fixture("board-list.html")), url)!;
    for (const j of page.jobs) {
      for (const [k, v] of Object.entries(j.client)) expect(v, `${j.externalId}.${k}`).not.toBeNaN();
    }
    expect(page.jobs.some((j) => j.client.paymentVerified === true)).toBe(true);
  });

  it("parses a detail page and marks it as such", () => {
    const page = parsePage(docOf(fixture("board-detail.html")), new URL("https://gigradar.example/demo-board/jobs/fx-1001"));
    expect(page?.page).toBe("detail");
    expect(page?.jobs).toHaveLength(1);
    expect(page?.jobs[0]?.externalId).toBe("fx-1001");
  });

  it("returns null for a page with no recognisable listings", () => {
    expect(parsePage(docOf("<html><body><h1>Hello</h1><p>nothing here</p></body></html>"), new URL("https://example.com/"))).toBeNull();
  });

  it("never emits non-http(s) listing URLs", () => {
    const html = `<div data-gr-board="fixture"><div data-gr-job data-gr-id="x"><a data-gr-title href="javascript:alert(1)">Evil</a></div></div>`;
    const page = parsePage(docOf(html), new URL("https://gigradar.example/demo-board"))!;
    expect(page.jobs[0]!.url.startsWith("https://")).toBe(true);
  });
});

describe("JSON-LD fallback (any board that publishes schema.org JobPosting)", () => {
  const ld = (o: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(o)}</script></head><body></body></html>`;

  it("parses a hourly JobPosting and strips HTML from the description", () => {
    const page = parsePage(
      docOf(ld({ "@context": "https://schema.org", "@type": "JobPosting", title: "Senior TypeScript contractor", description: "<p>Build <b>APIs</b> in Node.</p>", datePosted: "2026-10-01", baseSalary: { "@type": "MonetaryAmount", currency: "usd", value: { minValue: 60, maxValue: 90, unitText: "HOUR" } } })),
      new URL("https://jobs.example.com/p/123"),
    )!;
    expect(page.parser).toBe("jsonld");
    expect(page.jobs[0]).toMatchObject({ source: "other", title: "Senior TypeScript contractor", description: "Build APIs in Node.", budget: { type: "hourly", min: 60, max: 90, currency: "USD" } });
  });

  it("treats yearly salaries as an unknown project budget", () => {
    const page = parsePage(
      docOf(ld({ "@type": "JobPosting", title: "Staff engineer", description: "Full-time role", baseSalary: { currency: "USD", value: { value: 180000, unitText: "YEAR" } } })),
      new URL("https://jobs.example.com/p/9"),
    )!;
    expect(page.jobs[0]!.budget.type).toBe("unknown");
  });

  it("finds postings inside @graph and ignores broken JSON", () => {
    const html = `<script type="application/ld+json">{not json</script><script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "WebSite" }, { "@type": "JobPosting", title: "Designer", description: "x" }] })}</script>`;
    expect(parsePage(docOf(html), new URL("https://jobs.example.com/"))?.jobs.map((j) => j.title)).toEqual(["Designer"]);
  });
});

describe("marketplace parsers (synthetic markup — mechanics only)", () => {
  it("Upwork: reads a list card via the configured selectors", () => {
    const html = `<section><article data-test="JobTile">
      <h2><a data-test="job-title-link" href="/jobs/Build-API_~01abc123def/">Build a REST API in Node</a></h2>
      <div data-test="job-type-label">Fixed price: $1,500</div>
      <div data-test="job-description-text">Need an experienced Node developer for a REST API.</div>
      <span data-test="token">Node.js</span><span data-test="token">PostgreSQL</span>
      <div data-test="payment-verified">Payment verified</div>
      <div data-test="client-spendings">$12K spent</div>
      <div data-test="client-country">Germany</div>
    </article></section>`;
    const page = parsePage(docOf(html), new URL("https://www.upwork.com/nx/search/jobs/?q=node"))!;
    expect(page.parser).toBe("upwork");
    const j = page.jobs[0]!;
    expect(j.source).toBe("upwork");
    expect(j.title).toBe("Build a REST API in Node");
    expect(j.url).toBe("https://www.upwork.com/jobs/Build-API_~01abc123def/");
    expect(j.budget).toMatchObject({ type: "fixed" });
    expect(j.skills).toEqual(["Node.js", "PostgreSQL"]);
    expect(j.client).toMatchObject({ paymentVerified: true, country: "Germany" });
  });

  it("does not invent client facts the page doesn't state", () => {
    const html = `<article data-test="JobTile"><h2><a data-test="job-title-link" href="/jobs/X_~01a/">Small task</a></h2></article>`;
    const j = parsePage(docOf(html), new URL("https://www.upwork.com/nx/search/jobs/"))!.jobs[0]!;
    expect(j.client.paymentVerified).toBeUndefined();
    expect(j.client.rating).toBeUndefined();
    expect(j.client.totalSpent).toBeUndefined();
  });
});

describe("proposal prefill", () => {
  const setup = (html: string) => {
    document.body.innerHTML = html;
  };

  it("fills a controlled textarea with real input/change events and never touches the submit button", () => {
    setup(`<form data-gr-proposal-form><textarea id="cover_letter" name="cover_letter"></textarea><button type="submit">Submit proposal</button></form>`);
    let submitted = false;
    document.querySelector("form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      submitted = true;
    });
    const events: string[] = [];
    const ta = document.getElementById("cover_letter") as HTMLTextAreaElement;
    ta.addEventListener("input", () => events.push("input"));
    ta.addEventListener("change", () => events.push("change"));

    expect(findProposalField()).toBe(ta);
    expect(prefillProposal("Hello client — here is my plan.")).toEqual({ ok: true });
    expect(ta.value).toBe("Hello client — here is my plan.");
    expect(events).toEqual(["input", "change"]);
    expect(submitted).toBe(false);
    expect(document.getElementById("gigradar-prefill-banner")).not.toBeNull();
  });

  it("does not overwrite text the user already typed", () => {
    setup(`<textarea name="proposal">My own opening line.</textarea>`);
    prefillProposal("Draft body.");
    const v = (document.querySelector("textarea") as HTMLTextAreaElement).value;
    expect(v.startsWith("My own opening line.")).toBe(true);
    expect(v).toContain("Draft body.");
  });

  it("reports a clear error when there is no proposal box", () => {
    setup(`<p>No form here</p>`);
    const r = prefillProposal("x");
    expect(r.ok).toBe(false);
  });

  it("ignores disabled and read-only boxes", () => {
    setup(`<textarea name="cover" disabled></textarea><textarea name="proposal" readonly></textarea>`);
    expect(findProposalField()).toBeNull();
  });
});
