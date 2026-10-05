"use client";
import { X } from "lucide-react";
import { useState } from "react";

export function TagInput({ label, hint, value, onChange, placeholder, max = 50 }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (next.length < max && !next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p.slice(0, 60));
    onChange(next);
    setDraft("");
  };
  return (
    <div>
      <label className="block text-[13.5px] font-medium text-ink">{label}</label>
      {hint ? <p className="mt-0.5 text-[12.5px] text-muted">{hint}</p> : null}
      <div className="mt-2 flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-line-strong bg-bg/70 p-2 focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-white/8 py-1 pl-2 pr-1 text-[13px] text-ink">
            {t}
            <button type="button" aria-label={`Remove ${t}`} className="grid h-4 w-4 place-items-center rounded text-muted hover:bg-white/10 hover:text-ink" onClick={() => onChange(value.filter((v) => v !== t))}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (/[,\n]/.test(t)) {
              e.preventDefault();
              add(t);
            }
          }}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[8ch] flex-1 bg-transparent px-1.5 py-1 text-[14px] text-ink placeholder:text-faint focus:outline-none"
          aria-label={`Add ${label}`}
        />
      </div>
    </div>
  );
}
