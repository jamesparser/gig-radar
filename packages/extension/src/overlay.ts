import type { IngestItem } from "./types";

/**
 * In-page badges (shadow DOM so marketplace CSS can't break them and ours can't leak). Everything is built with
 * createElement/textContent — never innerHTML — because listing text is untrusted.
 */

const BADGE_ATTR = "data-gigradar-badge";
const PILL_ID = "gigradar-pill";

const CSS = `
  :host{all:initial}
  .badge{display:inline-flex;align-items:center;gap:8px;margin:6px 0;padding:5px 10px;border-radius:999px;border:1px solid var(--c);background:var(--bg);color:var(--c);font:600 12px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;max-width:100%}
  .n{font-variant-numeric:tabular-nums;font-size:13px}
  .t{font-weight:500;color:#e6edf3;opacity:.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:46ch}
  .exc{--c:#2dd4bf;--bg:#0b2523}.good{--c:#7ee787;--bg:#10260f}.maybe{--c:#f2cc60;--bg:#2b2310}.weak{--c:#8b949e;--bg:#1b1f24}.lock{--c:#b392f0;--bg:#211a33}
`;

function tone(item: IngestItem): string {
  if (item.locked) return "lock";
  const l = (item.label ?? "").toLowerCase();
  return l === "excellent" ? "exc" : l === "good" ? "good" : l === "maybe" ? "maybe" : "weak";
}

function badge(item: IngestItem): HTMLElement {
  const host = document.createElement("div");
  host.setAttribute(BADGE_ATTR, "");
  host.style.cssText = "all:initial;display:block;";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  const wrap = document.createElement("div");
  wrap.className = `badge ${tone(item)}`;
  const n = document.createElement("span");
  n.className = "n";
  const t = document.createElement("span");
  t.className = "t";
  if (item.locked) {
    n.textContent = "GigRadar · locked";
    t.textContent = "Free weekly matches used — upgrade to score this";
  } else {
    n.textContent = `GigRadar ${item.score}/100 · ${item.label}`;
    t.textContent = item.summary ?? "";
    wrap.title = item.summary ?? "";
  }
  wrap.append(n, t);
  root.append(style, wrap);
  return host;
}

export function clearBadges(doc: Document = document) {
  doc.querySelectorAll(`[${BADGE_ATTR}]`).forEach((n) => n.remove());
  doc.getElementById(PILL_ID)?.remove();
}

/** Attach a badge to each scanned element (`elements[i]` ↔ `items[i]`) and show a one-line summary pill. */
export function renderBadges(elements: (Element | null)[], items: IngestItem[]) {
  clearBadges();
  elements.forEach((el, i) => {
    const item = items[i];
    if (!el || !item) return;
    el.insertAdjacentElement("afterbegin", badge(item));
  });
  showPill(items);
}

function showPill(items: IngestItem[]) {
  const scored = items.filter((i) => i.score !== null);
  const locked = items.filter((i) => i.locked).length;
  const top = scored.reduce((m, i) => Math.max(m, i.score ?? 0), 0);
  const host = document.createElement("div");
  host.id = PILL_ID;
  host.style.cssText = "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646;";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    .p{font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;background:#0b1114;color:#e6edf3;border:1px solid #2dd4bf;border-radius:12px;padding:10px 12px;box-shadow:0 8px 30px rgba(0,0,0,.45);display:flex;gap:12px;align-items:center}
    b{color:#2dd4bf}button{all:unset;cursor:pointer;color:#8b949e;font-size:12px}button:hover{color:#e6edf3}button:focus-visible{outline:2px solid #2dd4bf;outline-offset:2px}
  `;
  const p = document.createElement("div");
  p.className = "p";
  p.setAttribute("role", "status");
  const msg = document.createElement("span");
  const strong = document.createElement("b");
  strong.textContent = "GigRadar";
  msg.append(strong, ` scored ${scored.length} listing${scored.length === 1 ? "" : "s"}`);
  if (scored.length) msg.append(` · best ${top}`);
  if (locked) msg.append(` · ${locked} locked (Free quota)`);
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Hide";
  close.addEventListener("click", () => host.remove());
  p.append(msg, close);
  root.append(style, p);
  document.documentElement.append(host);
}
