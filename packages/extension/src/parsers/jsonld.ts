import type { BoardParser, ParsedJob, ParsedPage } from "../types";
import { parseBudgetText, text } from "./util";

/**
 * Generic schema.org JobPosting parser. Many boards publish <script type="application/ld+json"> JobPosting data
 * (Ashby, Greenhouse, Lever, most company career pages), which makes this the most robust "other board" path.
 * Runs only on pages the user explicitly scans.
 */
function* postings(doc: Document): Generator<Record<string, any>> {
  for (const s of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    let data: unknown;
    try {
      data = JSON.parse(s.textContent ?? "");
    } catch {
      continue;
    }
    const stack: unknown[] = Array.isArray(data) ? [...data] : [data];
    while (stack.length) {
      const n = stack.pop() as Record<string, any> | undefined;
      if (!n || typeof n !== "object") continue;
      if (Array.isArray(n["@graph"])) stack.push(...n["@graph"]);
      const type = n["@type"];
      if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) yield n;
    }
  }
}

const stripHtml = (html: string) => {
  const d = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return text(d.body);
};

export const jsonLdParser: BoardParser = {
  id: "jsonld",
  label: "Job posting (JSON-LD)",
  matches: (_u, doc) => Array.from(postings(doc)).length > 0,
  parse(doc, url): ParsedPage {
    const jobs: ParsedJob[] = [];
    for (const p of postings(doc)) {
      const title = String(p.title ?? "").trim();
      if (!title) continue;
      const salary = p.baseSalary?.value ?? p.baseSalary;
      const unit = String(salary?.unitText ?? "").toUpperCase();
      const min = Number(salary?.minValue ?? salary?.value);
      const max = Number(salary?.maxValue ?? salary?.value);
      // Salaries quoted per year/month/week/day describe employment, not a project budget → treat as unknown.
      const periodic = ["YEAR", "MONTH", "WEEK", "DAY"].includes(unit);
      const hasPay = !periodic && (Number.isFinite(min) || Number.isFinite(max));
      jobs.push({
        source: "other",
        url: typeof p.url === "string" && /^https?:/.test(p.url) ? p.url : url.href,
        title,
        description: stripHtml(String(p.description ?? "")).slice(0, 8000),
        budget: hasPay
          ? {
              type: unit === "HOUR" ? "hourly" : "fixed",
              ...(Number.isFinite(min) ? { min } : {}),
              ...(Number.isFinite(max) ? { max } : {}),
              currency: String(p.baseSalary?.currency ?? "USD").slice(0, 3).toUpperCase(),
            }
          : periodic
          ? { type: "unknown", currency: "USD" }
          : parseBudgetText(String(p.description ?? "").slice(0, 400)),
        skills: Array.isArray(p.skills) ? p.skills.map(String).slice(0, 30) : typeof p.skills === "string" ? p.skills.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : [],
        client: p.hiringOrganization?.name ? { country: undefined } : {},
        postedAt: typeof p.datePosted === "string" ? p.datePosted : undefined,
      });
    }
    return { parser: "jsonld", page: jobs.length === 1 ? "detail" : jobs.length ? "list" : "unknown", jobs, elements: jobs.map(() => null) };
  },
};
