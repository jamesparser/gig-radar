"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { buttonClass } from "./ui";

export function CopyButton({ text, label = "Copy", className, size = "sm" }: { text: string; label?: string; className?: string; size?: "sm" | "md" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass({ variant: "secondary", size, className })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "Copied" : label}
    </button>
  );
}
