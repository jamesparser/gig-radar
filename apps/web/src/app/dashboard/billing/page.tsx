import { Check } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PLANS, PLAN_ORDER } from "@gigradar/core";
import { ensureLicense, getEntitlement, listLicenses, usageSummary } from "@gigradar/api";
import { CheckoutReturn, DevUpgrade, LicenseManager, ManageBillingButton, UpgradeButton } from "@/components/billing";
import { Badge, Card, Meter, Notice, SectionTitle, cn } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Plan & license" };

export default async function Billing() {
  const { ctx, userId, plan } = await requireUser();
  await ensureLicense(ctx, userId);
  const [ent, licenses, usage] = await Promise.all([getEntitlement(ctx, userId), listLicenses(ctx, userId), usageSummary(ctx, userId, plan)]);
  const billingReady = Boolean(ctx.stripe);
  const rank = { free: 0, pro: 1, studio: 2 } as const;

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Plan &amp; license</h1>
        <p className="mt-1 text-[14px] text-muted">
          You&apos;re on <b className="text-ink">{PLANS[plan].name}</b>
          {ent.currentPeriodEnd ? <> · {ent.cancelAtPeriodEnd ? "ends" : "renews"} {dateShort(ent.currentPeriodEnd.toISOString())}</> : null}
          {ent.status === "past_due" ? <> · <span className="text-warn">payment past due</span></> : null}.
        </p>
      </header>

      <Suspense fallback={null}><CheckoutReturn /></Suspense>

      {ctx.config.allowDevUpgrade ? <DevUpgrade current={plan} /> : null}
      {!billingReady && !ctx.config.allowDevUpgrade ? <Notice tone="warn">Billing isn&apos;t configured on this deployment yet (STRIPE_SECRET_KEY is missing).</Notice> : null}

      <section>
        <SectionTitle title="Plans" hint="Billed monthly through Stripe. This demo runs in Stripe test mode — use card 4242 4242 4242 4242, any future date, any CVC." />
        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const current = id === plan;
            return (
              <Card key={id} className={cn("flex flex-col p-5", current && "border-accent/40")}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold">{p.name}</h3>
                  {current ? <Badge tone="accent">Current</Badge> : null}
                </div>
                <p className="mt-3 flex items-baseline gap-1"><span className="text-3xl font-semibold tracking-tight">${p.priceUsdMonthly}</span><span className="text-sm text-muted">{p.priceUsdMonthly === 0 ? "forever" : "/month"}</span></p>
                <ul className="mt-4 flex-1 space-y-2">
                  {p.features.map((f) => <li key={f} className="flex gap-2 text-[13px] leading-snug"><Check size={14} className="mt-0.5 shrink-0 text-accent" />{f}</li>)}
                </ul>
                <div className="mt-5">
                  {id === "free" ? null : current ? (
                    ent.stripeCustomerId ? <ManageBillingButton /> : <p className="text-[12.5px] text-muted">Active.</p>
                  ) : rank[id] > rank[plan] ? (
                    plan !== "free" && ent.stripeCustomerId ? <ManageBillingButton /> : billingReady ? <UpgradeButton plan={id} label={`Upgrade to ${p.name} — $${p.priceUsdMonthly}/mo`} primary={id === "pro"} /> : <p className="text-[12.5px] text-muted">Checkout unavailable until Stripe is configured.</p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle title="Usage" hint="Metered per account; the Free quota resets Monday 00:00 UTC." />
        <Card className="grid gap-5 p-5 sm:grid-cols-3">
          <div>
            <p className="text-[12px] uppercase tracking-wider text-faint">Scored this week</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{usage.scoredThisWeek}<span className="text-sm font-normal text-muted"> / {usage.weeklyLimit ?? "unlimited"}</span></p>
            {usage.weeklyLimit !== null ? <div className="mt-2"><Meter value={usage.scoredThisWeek} max={usage.weeklyLimit} tone={usage.remaining === 0 ? "warn" : "accent"} /></div> : null}
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-faint">Drafts, last 30 days</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{usage.drafts30d}</p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-faint">Digests, last 30 days</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{usage.digests30d}</p>
          </div>
          <div className="sm:col-span-3">
            <p className="mb-2 text-[12px] uppercase tracking-wider text-faint">Last 14 days</p>
            <div className="flex h-16 items-end gap-1" aria-label="Daily activity">
              {usage.series.map((d) => {
                const max = Math.max(1, ...usage.series.map((x) => x.scored + x.drafts));
                const h = ((d.scored + d.drafts) / max) * 100;
                return <div key={d.day} title={`${d.day}: ${d.scored} scored, ${d.drafts} drafts`} className="flex-1 rounded-sm bg-accent/70" style={{ height: `${Math.max(h, 4)}%`, opacity: d.scored + d.drafts ? 1 : 0.15 }} />;
              })}
            </div>
          </div>
        </Card>
      </section>

      <LicenseManager initial={licenses} seats={PLANS[plan].seats} appUrl={ctx.config.appUrl} />
    </div>
  );
}
