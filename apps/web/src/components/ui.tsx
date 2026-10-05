import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- buttons */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export function buttonClass({ variant = "secondary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors select-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
  const sizes: Record<Size, string> = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" };
  const variants: Record<Variant, string> = {
    primary: "bg-accent text-accent-ink hover:bg-accent-strong shadow-[0_0_0_1px_rgba(45,212,191,.4),0_8px_24px_-8px_rgba(45,212,191,.45)]",
    secondary: "bg-surface-2 text-ink border border-line-strong hover:bg-[#182030]",
    ghost: "text-muted hover:text-ink hover:bg-white/5",
    danger: "bg-bad/10 text-bad border border-bad/30 hover:bg-bad/20",
  };
  return cn(base, sizes[size], variants[variant], className);
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={buttonClass({ variant, size, className })} />;
}

export function LinkButton({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass({ variant, size, className })} />;
}

/* ---------------------------------------------------------------- brand */

export function RadarMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="8.5" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.5" />
      <path d="M16 16 L27 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
      <circle cx="23" cy="20" r="1.8" fill="currentColor" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-ink", className)}>
      <span className="text-accent"><RadarMark /></span>
      <span className="text-[17px]">GigRadar</span>
    </span>
  );
}

/* ---------------------------------------------------------------- surfaces */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("rounded-[var(--radius-card)] border border-line bg-surface/80 backdrop-blur-sm", className)} />;
}

export function SectionTitle({ title, hint, right }: { title: string; hint?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint ? <p className="text-[13px] text-muted mt-0.5">{hint}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "accent"; className?: string }) {
  const tones = {
    neutral: "bg-white/5 text-muted border-line",
    good: "bg-good/10 text-good border-good/25",
    warn: "bg-warn/10 text-warn border-warn/25",
    bad: "bg-bad/10 text-bad border-bad/25",
    accent: "bg-accent/10 text-accent border-accent/25",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none", tones[tone], className)}>{children}</span>;
}

const PLAN_TONE = { free: "neutral", pro: "accent", studio: "good" } as const;
export function PlanBadge({ plan }: { plan: "free" | "pro" | "studio" }) {
  return <Badge tone={PLAN_TONE[plan]} className="uppercase tracking-wider">{plan}</Badge>;
}

const STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "good" | "warn" | "bad" | "accent" }> = {
  new: { label: "New", tone: "accent" },
  drafted: { label: "Drafted", tone: "neutral" },
  applied: { label: "Applied by you", tone: "warn" },
  won: { label: "Won", tone: "good" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function SourceBadge({ source }: { source: string }) {
  const label = source === "fixture" ? "Fixture board" : source.charAt(0).toUpperCase() + source.slice(1);
  return <Badge>{label}</Badge>;
}

/* ---------------------------------------------------------------- score */

export function scoreTone(score: number | null) {
  if (score === null) return "#64748b";
  if (score >= 80) return "#34d399";
  if (score >= 65) return "#2dd4bf";
  if (score >= 45) return "#fbbf24";
  return "#94a3b8";
}

export function ScoreRing({ score, size = 52, locked = false }: { score: number | null; size?: number; locked?: boolean }) {
  const stroke = Math.max(3, Math.round(size / 14));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = locked || score === null ? 0 : Math.min(100, Math.max(0, score));
  const color = scoreTone(locked ? null : score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={locked || score === null ? "Not scored" : `Fit score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-semibold tabular-nums" style={{ color, fontSize: size * 0.34 }}>
        {locked || score === null ? "—" : score}
      </span>
    </div>
  );
}

export function Meter({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "warn" }) {
  const pct = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className={cn("h-full rounded-full", tone === "accent" ? "bg-accent" : "bg-warn")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Notice({ tone = "neutral", children, className }: { tone?: "neutral" | "warn" | "good" | "bad"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "border-line bg-white/[.03] text-muted",
    warn: "border-warn/30 bg-warn/[.07] text-warn",
    good: "border-good/30 bg-good/[.07] text-good",
    bad: "border-bad/30 bg-bad/[.07] text-bad",
  } as const;
  return <div className={cn("rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed", tones[tone], className)}>{children}</div>;
}
