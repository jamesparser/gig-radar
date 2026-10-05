/**
 * Proposal prefill. Fills a proposal textarea with the draft text and shows a banner.
 * It NEVER clicks, submits or focuses a submit control — the human reviews, edits and presses Submit.
 */

const SELECTORS = [
  "[data-gr-proposal-form] textarea",
  'textarea[name*="cover" i]',
  'textarea[id*="cover" i]',
  'textarea[name*="proposal" i]',
  'textarea[id*="proposal" i]',
  'textarea[placeholder*="proposal" i]',
  'textarea[aria-label*="cover letter" i]',
  'textarea[aria-label*="proposal" i]',
];

const visible = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  const hiddenByCss = getComputedStyle(el).visibility === "hidden" || getComputedStyle(el).display === "none";
  // jsdom has no layout; treat zero-size as visible there (no layout engine) but hidden in real browsers via CSS checks.
  return !hiddenByCss && (r.width > 0 || r.height > 0 || typeof window.innerWidth !== "number" || navigator.userAgent.includes("jsdom"));
};

export function findProposalField(doc: Document = document): HTMLTextAreaElement | null {
  for (const sel of SELECTORS) {
    const el = Array.from(doc.querySelectorAll<HTMLTextAreaElement>(sel)).find((e) => !e.disabled && !e.readOnly && visible(e));
    if (el) return el;
  }
  return null;
}

/** React/Vue-controlled inputs ignore plain `.value =`; use the native setter and dispatch real events. */
function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const BANNER_ID = "gigradar-prefill-banner";

function showBanner(field: HTMLElement) {
  document.getElementById(BANNER_ID)?.remove();
  const host = document.createElement("div");
  host.id = BANNER_ID;
  host.style.cssText = "all:initial;display:block;margin:6px 0;";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    .b{font:13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;background:#0f2a2a;color:#d9fffa;border:1px solid #2dd4bf;border-radius:8px;padding:9px 12px;display:flex;gap:10px;align-items:center;justify-content:space-between}
    button{all:unset;cursor:pointer;color:#2dd4bf;font-weight:600}
    button:focus-visible{outline:2px solid #2dd4bf;outline-offset:2px}
  `;
  const wrap = document.createElement("div");
  wrap.className = "b";
  wrap.setAttribute("role", "status");
  const msg = document.createElement("span");
  msg.textContent = "GigRadar filled this draft. Read it, edit it, check the “you still must do” list — then you press Submit.";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Dismiss";
  close.addEventListener("click", () => host.remove());
  wrap.append(msg, close);
  root.append(style, wrap);
  field.insertAdjacentElement("beforebegin", host);
}

export function prefillProposal(text: string): { ok: true } | { ok: false; error: string } {
  const field = findProposalField();
  if (!field) return { ok: false, error: "No proposal box found on this page. Copy the draft from the popup and paste it in yourself." };
  if (field.value.trim() && field.value.trim() !== text.trim()) {
    // Never clobber text the user already typed without telling them: append below a divider instead.
    setNativeValue(field, `${field.value.replace(/\s+$/, "")}\n\n---\n${text}`);
  } else {
    setNativeValue(field, text);
  }
  showBanner(field);
  field.scrollIntoView?.({ block: "center", behavior: "smooth" });
  return { ok: true };
}
