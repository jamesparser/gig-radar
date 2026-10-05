"use client";
import { useState } from "react";
import { Button } from "./ui";

/** The "submit" button on the fixture board is deliberately inert: it demonstrates that the human is the one who sends. */
export function FixtureProposalForm() {
  const [sent, setSent] = useState(false);
  return (
    <form
      data-gr-proposal-form=""
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
      className="mt-8 rounded-xl border border-line bg-surface/70 p-5"
    >
      <h2 className="text-[15px] font-semibold">Your proposal</h2>
      <label className="mt-3 block text-[13px] text-muted" htmlFor="cover_letter">Cover letter</label>
      <textarea id="cover_letter" name="cover_letter" rows={9} placeholder="Write your proposal… (GigRadar can prefill this from your draft — you still press Submit.)" className="mt-1.5 w-full rounded-lg border border-line-strong bg-bg/70 p-3.5 text-[14px] leading-relaxed text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none" />
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" variant="primary">Submit proposal</Button>
        {sent ? <span className="text-[13px] text-good">Fixture board: nothing was sent. On a real marketplace, this is your click.</span> : null}
      </div>
    </form>
  );
}
