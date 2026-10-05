import type { BoardParser, ClientSignals, ParsedJob, ParsedPage } from "../types";
import { abs, text } from "./util";

/**
 * Fixture-board parser — the supported, deterministic path for demos and tests.
 *
 * Documented `data-gr-*` schema (see apps/web/src/components/fixture-board.tsx):
 *   [data-gr-board="fixture"]            page marker
 *   [data-gr-job] [data-gr-id]           one listing; [data-gr-detail] marks a detail page
 *   [data-gr-title]                      title (an <a> on list pages → listing URL)
 *   [data-gr-description]                description text
 *   [data-gr-budget] + data-gr-budget-type|min|max|currency
 *   [data-gr-skill]                      one per skill
 *   [data-gr-client] + data-gr-payment-verified|rating|spent|hire-rate|proposals|country
 *   [data-gr-posted] datetime=ISO
 *
 * The same interface is how real boards get supported: implement `BoardParser` and register it in parsers/index.ts.
 */
const num = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? undefined : Number.isNaN(Number(v)) ? undefined : Number(v));

export const fixtureParser: BoardParser = {
  id: "fixture",
  label: "Fixture board",
  matches: (_url, doc) => doc.querySelector('[data-gr-board="fixture"]') !== null,
  parse(doc, url): ParsedPage {
    const cards = Array.from(doc.querySelectorAll<HTMLElement>("[data-gr-job]"));
    const jobs: ParsedJob[] = [];
    const elements: Element[] = [];
    for (const card of cards) {
      const titleEl = card.querySelector<HTMLElement>("[data-gr-title]");
      const title = text(titleEl);
      if (!title) continue;
      const href = titleEl?.getAttribute("href");
      const jobUrl = (href ? abs(href, url.href) : null) ?? url.href;
      const budgetEl = card.querySelector<HTMLElement>("[data-gr-budget]");
      const clientEl = card.querySelector<HTMLElement>("[data-gr-client]");
      const verified = clientEl?.getAttribute("data-gr-payment-verified");
      const client: ClientSignals = {
        ...(verified !== null && verified !== undefined ? { paymentVerified: verified === "true" } : {}),
        ...(num(clientEl?.getAttribute("data-gr-rating")) !== undefined ? { rating: num(clientEl?.getAttribute("data-gr-rating")) } : {}),
        ...(num(clientEl?.getAttribute("data-gr-spent")) !== undefined ? { totalSpent: num(clientEl?.getAttribute("data-gr-spent")) } : {}),
        ...(num(clientEl?.getAttribute("data-gr-hire-rate")) !== undefined ? { hireRate: num(clientEl?.getAttribute("data-gr-hire-rate")) } : {}),
        ...(num(clientEl?.getAttribute("data-gr-proposals")) !== undefined ? { proposals: num(clientEl?.getAttribute("data-gr-proposals")) } : {}),
        ...(clientEl?.getAttribute("data-gr-country") ? { country: clientEl.getAttribute("data-gr-country")! } : {}),
      };
      const type = budgetEl?.getAttribute("data-gr-budget-type");
      jobs.push({
        source: "fixture",
        externalId: card.getAttribute("data-gr-id") ?? undefined,
        url: jobUrl,
        title,
        description: text(card.querySelector("[data-gr-description]")),
        budget: {
          type: type === "hourly" || type === "fixed" ? type : "unknown",
          min: num(budgetEl?.getAttribute("data-gr-budget-min")),
          max: num(budgetEl?.getAttribute("data-gr-budget-max")),
          currency: budgetEl?.getAttribute("data-gr-currency") || "USD",
        },
        skills: Array.from(card.querySelectorAll("[data-gr-skill]")).map((s) => text(s)).filter(Boolean),
        client,
        postedAt: card.querySelector("[data-gr-posted]")?.getAttribute("datetime") ?? undefined,
      });
      elements.push(card);
    }
    const detail = cards.some((c) => c.hasAttribute("data-gr-detail"));
    return { parser: "fixture", page: jobs.length === 0 ? "unknown" : detail ? "detail" : "list", jobs, elements };
  },
};
