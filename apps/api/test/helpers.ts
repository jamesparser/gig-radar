import Stripe from "stripe";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { createContext, type Ctx, type ContextOverrides } from "../src/context";

export const APP_URL = "http://localhost:3000";
export const WEBHOOK_SECRET = "whsec_test_secret";
export const CRON_SECRET = "cron-secret-for-tests";

export async function makeCtx(overrides: ContextOverrides = {}): Promise<Ctx> {
  const config = loadConfig({
    NODE_ENV: "test",
    APP_URL,
    BETTER_AUTH_SECRET: "a".repeat(48),
    LICENSE_SECRET: "b".repeat(48),
    STRIPE_SECRET_KEY: "sk_test_dummy",
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    CRON_SECRET,
  });
  return createContext(config, { llm: null, mailer: null, ...overrides });
}

export type TestApp = ReturnType<typeof createApp>;

export function makeApp(ctx: Ctx): TestApp {
  return createApp({ getCtx: async () => ctx });
}

export interface Client {
  cookie: string;
  userId: string;
  email: string;
  call: (method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<{ status: number; json: any; res: Response }>;
}

let n = 0;
export async function signUp(app: TestApp, label = "user"): Promise<Client> {
  const email = `${label}-${++n}-${Date.now()}@example.test`;
  const res = await app.request(`${APP_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP_URL },
    body: JSON.stringify({ name: "Alex Rivera", email, password: "correct horse battery staple" }),
  });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  const setCookies = res.headers.getSetCookie();
  const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  const body = (await res.json()) as { user: { id: string } };
  const call: Client["call"] = async (method, path, payload, headers = {}) => {
    const r = await app.request(`${APP_URL}/api${path}`, {
      method,
      headers: { "content-type": "application/json", origin: APP_URL, cookie, ...headers },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const text = await r.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: r.status, json, res: r };
  };
  return { cookie, userId: body.user.id, email, call };
}

/** A license-key client (what the extension does): no cookie, just the header. */
export function licenseCall(app: TestApp, key: string) {
  return async (method: string, path: string, payload?: unknown) => {
    const r = await app.request(`${APP_URL}/api${path}`, {
      method,
      headers: { "content-type": "application/json", "x-gigradar-license": key },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const text = await r.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: r.status, json };
  };
}

export const stripeForTests = () => new Stripe("sk_test_dummy");

export function signedWebhook(stripe: Stripe, event: object) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, header };
}

export function subscriptionObject(opts: { id: string; userId: string; lookupKey: string; status?: string; customer?: string; periodEnd?: number }) {
  return {
    id: opts.id,
    object: "subscription",
    customer: opts.customer ?? "cus_test_1",
    status: opts.status ?? "active",
    cancel_at_period_end: false,
    metadata: { userId: opts.userId },
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          current_period_end: opts.periodEnd ?? Math.floor(Date.now() / 1000) + 30 * 86400,
          price: { id: `price_${opts.lookupKey}`, object: "price", lookup_key: opts.lookupKey },
        },
      ],
    },
  };
}
