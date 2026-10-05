import type { Draft } from "./schemas";
import { MANDATORY_STEPS } from "./proposal";
import type { FitLabel } from "./scoring";

/**
 * Email digest template. Pure function: data in → { subject, html, text } out.
 * All third-party strings (job titles, descriptions) are HTML-escaped; hrefs must be http(s).
 */

export interface DigestItem {
  title: string;
  source: string;
  budgetText: string;
  score: number;
  label: FitLabel;
  summary: string;
  redFlags: string[];
  /** The marketplace listing — where the human submits. */
  submitUrl: string;
  /** Link to the match inside the GigRadar dashboard (full draft, edit, copy). */
  matchUrl: string;
  draft?: Draft | null;
}

export interface DigestInput {
  recipientName?: string | null;
  appUrl: string;
  items: DigestItem[];
  planName: string;
  generatedAt?: Date;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeUrl(u: string): string {
  try {
    const parsed = new URL(u);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
  } catch {
    /* fall through */
  }
  return "#";
}

const COLORS = {
  bg: "#0b0d12",
  card: "#12151c",
  border: "#232a36",
  text: "#e7eaf0",
  muted: "#9aa4b5",
  accent: "#2dd4bf",
  warn: "#fbbf24",
};

function scoreColor(score: number): string {
  if (score >= 80) return "#34d399";
  if (score >= 65) return "#2dd4bf";
  if (score >= 45) return "#fbbf24";
  return "#94a3b8";
}

export function digestSubject(items: DigestItem[]): string {
  if (items.length === 0) return "GigRadar: no new matches today";
  const top = items.reduce((a, b) => (b.score > a.score ? b : a));
  const n = items.length;
  const t = top.title.length > 60 ? top.title.slice(0, 57) + "…" : top.title;
  return `GigRadar: ${n} ${n === 1 ? "gig fits" : "gigs fit"} you — top match ${top.score}: ${t}`;
}

export function renderDigest(input: DigestInput): RenderedEmail {
  const { items, appUrl } = input;
  const subject = digestSubject(items);
  const hello = input.recipientName ? `Hi ${escapeHtml(input.recipientName.split(" ")[0] ?? "")},` : "Hi,";
  const helloText = input.recipientName ? `Hi ${input.recipientName.split(" ")[0]},` : "Hi,";

  const itemHtml = items.map((it) => renderItemHtml(it)).join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.bg};color:${COLORS.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="padding:0 4px 16px 4px;">
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${COLORS.accent};margin-right:8px;"></span>
    <span style="font-size:18px;font-weight:700;letter-spacing:.2px;">GigRadar</span>
    <span style="color:${COLORS.muted};font-size:13px;margin-left:8px;">daily digest · ${escapeHtml(input.planName)}</span>
  </td></tr>
  <tr><td style="padding:0 4px 18px 4px;font-size:15px;line-height:1.55;color:${COLORS.text};">
    ${hello}<br>${items.length === 0 ? "No new gigs cleared your match threshold since the last digest." : `${items.length} ${items.length === 1 ? "gig" : "gigs"} cleared your match threshold. Each one has a draft proposal and a checklist of what's left for <b>you</b> to do. Open the listing, review, and submit it yourself.`}
  </td></tr>
${itemHtml}
  <tr><td style="padding:18px 4px 6px 4px;font-size:12px;line-height:1.6;color:${COLORS.muted};">
    GigRadar is a co-pilot: it finds gigs and drafts the pitch — you close the deal. We never submit proposals on your behalf.<br>
    <a href="${escapeHtml(safeUrl(appUrl + "/dashboard"))}" style="color:${COLORS.accent};">Open dashboard</a> ·
    <a href="${escapeHtml(safeUrl(appUrl + "/dashboard/profile"))}" style="color:${COLORS.accent};">Edit your skills profile</a> ·
    <a href="${escapeHtml(safeUrl(appUrl + "/privacy"))}" style="color:${COLORS.accent};">Privacy</a>
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    helloText,
    "",
    items.length === 0
      ? "No new gigs cleared your match threshold since the last digest."
      : `${items.length} ${items.length === 1 ? "gig" : "gigs"} cleared your match threshold. Review each one and submit it yourself.`,
    "",
    ...items.map((it, i) => renderItemText(it, i + 1)),
    "—",
    "GigRadar is a co-pilot: it finds gigs and drafts the pitch — you close the deal. We never submit proposals on your behalf.",
    `Dashboard: ${appUrl}/dashboard`,
  ].join("\n");

  return { subject, html, text };
}

function renderItemHtml(it: DigestItem): string {
  const color = scoreColor(it.score);
  const steps = (it.draft?.youStillMust ?? MANDATORY_STEPS).slice(0, 6);
  const excerpt = it.draft ? it.draft.coverLetter.slice(0, 420) + (it.draft.coverLetter.length > 420 ? "…" : "") : null;
  const milestones = it.draft
    ? it.draft.milestones
        .map((m) => `<li style="margin:0 0 4px 0;">${escapeHtml(m.title)} <span style="color:${COLORS.muted};">— ${m.percentOfBudget}% · ~${m.durationDays}d</span></li>`)
        .join("")
    : "";
  return `  <tr><td style="padding:0 0 14px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;">
      <tr>
        <td width="64" valign="top" style="padding:16px 0 16px 16px;">
          <div style="width:52px;height:52px;border-radius:50%;border:3px solid ${color};text-align:center;line-height:46px;font-size:18px;font-weight:700;color:${color};">${it.score}</div>
        </td>
        <td valign="top" style="padding:16px 16px 4px 12px;">
          <div style="font-size:16px;font-weight:600;line-height:1.35;color:${COLORS.text};">${escapeHtml(it.title)}</div>
          <div style="font-size:12px;color:${COLORS.muted};margin-top:3px;">${escapeHtml(it.source)} · ${escapeHtml(it.budgetText)} · ${escapeHtml(it.label)} fit</div>
          <div style="font-size:13px;line-height:1.5;color:${COLORS.text};margin-top:8px;">${escapeHtml(it.summary)}</div>
          ${it.redFlags.length ? `<div style="font-size:12px;color:${COLORS.warn};margin-top:6px;">⚠ ${it.redFlags.map(escapeHtml).join(" · ")}</div>` : ""}
        </td>
      </tr>
      ${excerpt ? `<tr><td colspan="2" style="padding:6px 16px 0 16px;">
        <div style="font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:${COLORS.muted};margin-bottom:4px;">Draft cover letter (edit before sending)</div>
        <div style="font-size:13px;line-height:1.55;color:#cbd2de;white-space:pre-wrap;background:#0e1118;border:1px solid ${COLORS.border};border-radius:8px;padding:10px 12px;">${escapeHtml(excerpt)}</div>
        <div style="font-size:12px;color:#cbd2de;margin-top:10px;line-height:1.5;"><b>Milestones</b><ul style="margin:4px 0 0 18px;padding:0;">${milestones}</ul></div>
      </td></tr>` : ""}
      <tr><td colspan="2" style="padding:12px 16px 0 16px;">
        <div style="font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:${COLORS.muted};margin-bottom:4px;">What you still must do</div>
        <table role="presentation" cellpadding="0" cellspacing="0">${steps
          .map((s) => `<tr><td valign="top" style="padding:0 8px 4px 0;font-size:13px;color:${COLORS.accent};">☐</td><td style="padding:0 0 4px 0;font-size:13px;line-height:1.45;color:${COLORS.text};">${escapeHtml(s)}</td></tr>`)
          .join("")}</table>
      </td></tr>
      <tr><td colspan="2" style="padding:12px 16px 16px 16px;">
        <a href="${escapeHtml(safeUrl(it.submitUrl))}" style="display:inline-block;background:${COLORS.accent};color:#04201c;font-weight:700;font-size:13px;text-decoration:none;padding:9px 14px;border-radius:8px;margin-right:8px;">Open listing &amp; submit yourself →</a>
        <a href="${escapeHtml(safeUrl(it.matchUrl))}" style="display:inline-block;color:${COLORS.accent};font-size:13px;text-decoration:none;padding:9px 6px;">Full draft in GigRadar</a>
      </td></tr>
    </table>
  </td></tr>`;
}

function renderItemText(it: DigestItem, n: number): string {
  const steps = (it.draft?.youStillMust ?? MANDATORY_STEPS).slice(0, 6);
  return [
    `${n}. [${it.score}] ${it.title}`,
    `   ${it.source} · ${it.budgetText} · ${it.label} fit`,
    `   ${it.summary}`,
    ...(it.redFlags.length ? [`   WARNING: ${it.redFlags.join(" · ")}`] : []),
    ...(it.draft ? ["", "   Draft cover letter (edit before sending):", ...it.draft.coverLetter.split("\n").map((l) => `   | ${l}`), ""] : []),
    "   What you still must do:",
    ...steps.map((s) => `   [ ] ${s}`),
    `   Submit yourself: ${safeUrl(it.submitUrl)}`,
    `   Full draft: ${safeUrl(it.matchUrl)}`,
    "",
  ].join("\n");
}
