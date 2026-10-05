/**
 * `npm run stripe:setup` — creates the Pro ($29/mo) and Studio ($99/mo) Products + Prices in Stripe TEST mode,
 * keyed by lookup_key so it is safe to re-run. Optionally registers the webhook endpoint:
 *
 *   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup -- --webhook-url https://YOUR-APP.vercel.app/api/stripe/webhook
 *
 * Prints the env vars to copy into Vercel. Refuses live keys unless you pass --live.
 */
import Stripe from "stripe";
import { PLANS } from "@gigradar/core";

const key = process.env.STRIPE_SECRET_KEY;
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : (args[i + 1] ?? "true");
};

if (!key) {
  console.error("Set STRIPE_SECRET_KEY (use a sk_test_… key).");
  process.exit(1);
}
if (!key.startsWith("sk_test_") && flag("--live") === undefined) {
  console.error("Refusing to run with a live key. Use a test-mode key, or pass --live if you really mean it.");
  process.exit(1);
}

const stripe = new Stripe(key, { appInfo: { name: "GigRadar setup", version: "0.1.0" } });
const out: Record<string, string> = {};

for (const id of ["pro", "studio"] as const) {
  const plan = PLANS[id];
  const lookup = plan.stripeLookupKey!;
  const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  let price = existing.data[0];
  if (!price) {
    const product = await stripe.products.create({
      name: `GigRadar ${plan.name}`,
      description: plan.tagline,
      metadata: { gigradar_plan: id },
    });
    price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: plan.priceUsdMonthly * 100,
      recurring: { interval: "month" },
      lookup_key: lookup,
      metadata: { gigradar_plan: id },
    });
    console.log(`Created ${plan.name}: $${plan.priceUsdMonthly}/mo → ${price.id}`);
  } else {
    console.log(`Found   ${plan.name}: ${price.id} (lookup_key ${lookup})`);
  }
  out[`STRIPE_PRICE_${id.toUpperCase()}`] = price.id;
}

const webhookUrl = flag("--webhook-url");
if (webhookUrl) {
  const endpoint = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ],
    description: "GigRadar billing",
  });
  out.STRIPE_WEBHOOK_SECRET = endpoint.secret ?? "(see Stripe dashboard)";
  console.log(`Registered webhook endpoint ${endpoint.id} → ${webhookUrl}`);
} else {
  console.log("\nNo --webhook-url given. Add an endpoint in the Stripe dashboard (or run: stripe listen --forward-to localhost:3000/api/stripe/webhook).");
}

console.log("\n# Add these to your environment (Vercel → Settings → Environment Variables):");
console.log(`STRIPE_SECRET_KEY=${key.slice(0, 12)}…(your key)`);
for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
