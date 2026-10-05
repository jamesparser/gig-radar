import { BadgeCheck, BellRing, Check, Puzzle, FileText, Lock, Radar, ShieldCheck, SlidersHorizontal, UserCheck } from "lucide-react";
import Link from "next/link";
import { HeroRadar } from "@/components/landing-hero";
import { Badge, Card, LinkButton, Logo, cn } from "@/components/ui";
import { MANDATORY_STEPS, ONE_LINER, PLANS, PLAN_ORDER } from "@gigradar/core";

const REPO = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/jamesparser/gig-radar";

const STEPS = [
  { icon: SlidersHorizontal, title: "Tell it what you're good at", body: "Skills, rate floor, niches, and keywords you never want to see. Two minutes, and you can change it any time." },
  { icon: Puzzle, title: "Browse like you always do", body: "The Chrome extension reads the listings you open on Upwork, Fiverr and Freelancer and scores each one against your profile." },
  { icon: FileText, title: "Get the pitch drafted", body: "A tailored cover letter, three milestones and the questions worth asking — built only from facts in your profile." },
  { icon: UserCheck, title: "Review, edit, send — yourself", body: "Your digest lists exactly what's left for you to do, with the link to the listing. GigRadar never submits for you." },
];

const TRUST = [
  { icon: ShieldCheck, title: "A co-pilot, not a bot", body: "No auto-apply, no stored marketplace passwords, no stealth. The extension reads pages you open; a human always presses send." },
  { icon: Lock, title: "Your data, your call", body: "Only listings you view are stored. Export everything as JSON or delete your account in one click." },
  { icon: BadgeCheck, title: "Honest drafts", body: "Drafts use only what's in your profile and insert [placeholders] instead of inventing experience. Links not in your portfolio are stripped." },
  { icon: BellRing, title: "Injection-resistant", body: "Job text is treated as untrusted data. A listing that says “ignore your instructions” gets ignored." },
];

const FAQ = [
  { q: "Is this allowed on Upwork, Fiverr and Freelancer?", a: "Each marketplace has its own terms about automation, and you're responsible for following them. GigRadar is designed to stay on the safe side: it only reads listings you open yourself, never logs in as you, never submits proposals, and never works around bot detection. Where live parsing is brittle, fixture mode lets you try the full loop without touching a marketplace." },
  { q: "What does the Free plan include?", a: "Radar only: five scored matches per week with the full score breakdown. Proposal drafts and the email digest are part of Pro." },
  { q: "Where do the drafts come from?", a: "A language model, instructed to use only your profile and the listing. If no model is configured or it fails, a deterministic template is used and labelled as such." },
  { q: "Can I try it without installing anything?", a: "Yes. Create an account and press “Load sample jobs” to run the whole loop on fictional listings." },
];

export default function Landing() {
  return (
    <div className="relative">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]" />

      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="GigRadar home"><Logo /></Link>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <a href="#trust" className="hover:text-ink">Trust</a>
          <a href="#faq" className="hover:text-ink">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <LinkButton href="/login" variant="ghost" size="sm">Sign in</LinkButton>
          <LinkButton href="/signup" variant="primary" size="sm">Start free</LinkButton>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 overflow-x-clip items-center gap-14 px-5 pb-20 pt-12 md:pt-20 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/[.03] px-3 py-1 text-[12.5px] text-muted">
            <Radar size={14} className="text-accent" /> Co-pilot for Upwork · Fiverr · Freelancer
          </span>
          <h1 className="mt-5 text-[40px] font-semibold leading-[1.06] tracking-tight text-ink sm:text-[56px]">
            Find the gigs that fit.<br />
            Draft the pitch.<br />
            <span className="text-accent">You close the deal.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
            GigRadar scores every listing against your skills and rate floor, drafts a tailored proposal with milestones, and emails you a checklist of what&apos;s left to do.
            You review it and press send — always.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LinkButton href="/signup" variant="primary" size="lg">Start free — no card</LinkButton>
            <LinkButton href="#how" variant="secondary" size="lg">See the loop</LinkButton>
          </div>
          <p className="mt-4 text-[13px] text-faint">Free: 5 scored matches a week. Pro: $29/mo for the full loop.</p>
        </div>
        <HeroRadar />
      </section>

      {/* how */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <p className="text-[13px] font-medium uppercase tracking-[.14em] text-accent">The loop</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">Hours of hunting and pitch-writing, down to a review.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Card key={s.title} className="p-5">
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/10 text-accent"><s.icon size={18} /></span>
                <span className="font-mono text-xs text-faint">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* digest highlight */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid items-center gap-10 rounded-3xl border border-line bg-surface/70 p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-[.14em] text-accent">The part other tools skip</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Every draft ships with “what you still must do.”</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              A good proposal is yours, not a model&apos;s. Each match in your daily digest comes with a checklist and the link to submit — so the human steps are explicit, not forgotten.
            </p>
            <ul className="mt-6 space-y-2.5">
              {["Score and the reasons behind it", "Cover letter, 3 milestones, client questions", "A checklist you tick off yourself", "One link: open the listing and submit"].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14px] text-ink"><Check size={16} className="mt-0.5 shrink-0 text-accent" />{t}</li>
              ))}
            </ul>
          </div>
          <Card className="p-5">
            <p className="text-[11px] font-medium uppercase tracking-[.14em] text-faint">What you still must do</p>
            <ul className="mt-3 space-y-2.5">
              {[...MANDATORY_STEPS.slice(0, 2), "Replace every [bracketed placeholder] with a real detail.", "Attach 1–2 samples from your own portfolio.", MANDATORY_STEPS[2]!].map((s) => (
                <li key={s} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-ink">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-line-strong" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center gap-2">
              <span className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-accent-ink">Open listing &amp; submit yourself →</span>
              <span className="text-[12px] text-faint">GigRadar never submits for you</span>
            </div>
          </Card>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <p className="text-[13px] font-medium uppercase tracking-[.14em] text-accent">Pricing</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Radar is free. The full loop is $29.</h2>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">Free shows you what fits. Paid plans add the part that saves the hours: drafts and the digest.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const featured = id === "pro";
            return (
              <Card key={id} className={cn("relative flex flex-col p-6", featured && "border-accent/40 shadow-[0_0_0_1px_rgba(45,212,191,.25),0_30px_60px_-30px_rgba(45,212,191,.25)]")}>
                {featured ? <Badge tone="accent" className="absolute right-5 top-5">Most popular</Badge> : null}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-1 text-[13.5px] text-muted">{p.tagline}</p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">${p.priceUsdMonthly}</span>
                  <span className="text-sm text-muted">{p.priceUsdMonthly === 0 ? "forever" : "/month"}</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-ink"><Check size={15} className="mt-0.5 shrink-0 text-accent" />{f}</li>
                  ))}
                </ul>
                <LinkButton href="/signup" variant={featured ? "primary" : "secondary"} className="mt-6">
                  {id === "free" ? "Start free" : `Get ${p.name}`}
                </LinkButton>
              </Card>
            );
          })}
        </div>
        <p className="mt-4 text-[12.5px] text-faint">Billing by Stripe. This demo deployment runs Stripe in test mode — use card 4242 4242 4242 4242; no real charges.</p>
      </section>

      {/* trust */}
      <section id="trust" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <p className="text-[13px] font-medium uppercase tracking-[.14em] text-accent">Built to be trusted</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">A co-pilot you can explain to your clients.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {TRUST.map((t) => (
            <Card key={t.title} className="flex gap-4 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/5 text-accent"><t.icon size={19} /></span>
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">{t.title}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{t.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">Questions</h2>
        <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface/60">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
                {f.q}
                <span className="text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2.5 text-[14px] leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* final CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="rounded-3xl border border-accent/25 bg-gradient-to-b from-accent/10 to-transparent p-10 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">{ONE_LINER}</h2>
          <div className="mt-6 flex justify-center gap-3">
            <LinkButton href="/signup" variant="primary" size="lg">Start free</LinkButton>
            <LinkButton href="/demo-board" variant="secondary" size="lg">Browse the fixture board</LinkButton>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] text-muted">
          <Logo className="text-[15px]" />
          <nav className="flex flex-wrap items-center gap-6">
            <Link href="/privacy" className="hover:text-ink">Privacy &amp; governance</Link>
            <a href={REPO} className="hover:text-ink" rel="noopener noreferrer">GitHub</a>
            <Link href="/login" className="hover:text-ink">Sign in</Link>
          </nav>
          <p className="text-faint">Hackathon build · Galuxium Nexus V2 · not affiliated with any marketplace</p>
        </div>
      </footer>
    </div>
  );
}
