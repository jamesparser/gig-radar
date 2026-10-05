import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Ctx } from "../src/context";
import { auditEvents, digests, licenses, matches, subscriptions, user } from "../src/db/schema";
import type { LlmProvider } from "../src/providers/llm";
import type { Mailer } from "../src/providers/mailer";
import {
  APP_URL,
  CRON_SECRET,
  licenseCall,
  makeApp,
  makeCtx,
  signUp,
  signedWebhook,
  stripeForTests,
  subscriptionObject,
  type TestApp,
} from "./helpers";

let ctx: Ctx;
let app: TestApp;
const sent: { to: string; subject: string; html: string; text: string }[] = [];
const mailer: Mailer = { name: "test-mailer", send: async (m) => (sent.push(m), { id: `msg_${sent.length}` }) };
let llmMode: "valid" | "garbage" | "throws" | "evil" = "garbage";
const llm: LlmProvider = {
  name: "stub:model-1",
  async complete() {
    if (llmMode === "throws") throw new Error("provider down");
    if (llmMode === "garbage") return "I cannot do that";
    const evil = llmMode === "evil";
    return JSON.stringify({
      coverLetter: `I read your brief carefully and my TypeScript and React background fits it well.${evil ? " Details at https://evil.test/steal" : ""} ${"Lorem ipsum ".repeat(12)}`,
      milestones: [
        { title: "Plan", description: "Scope and plan", durationDays: 2, percentOfBudget: 25 },
        { title: "Build", description: "Core build", durationDays: 8, percentOfBudget: 50 },
        { title: "Handover", description: "Revisions and docs", durationDays: 3, percentOfBudget: 25 },
      ],
      clientQuestions: ["What does done look like?"],
      youStillMust: ["Attach one portfolio sample."],
    });
  },
};

beforeAll(async () => {
  ctx = await makeCtx({ llm, mailer });
  app = makeApp(ctx);
});
afterAll(async () => ctx.close());

describe("health + auth", () => {
  it("reports health and feature flags without leaking secrets", async () => {
    const r = await app.request(`${APP_URL}/api/health`);
    const j = (await r.json()) as any;
    expect(r.status).toBe(200);
    expect(j.ok).toBe(true);
    expect(j.features.drafts).toBe("stub:model-1");
    expect(JSON.stringify(j)).not.toMatch(/sk_test|whsec|secret/i);
  });
  it("rejects unauthenticated access", async () => {
    const r = await app.request(`${APP_URL}/api/me`);
    expect(r.status).toBe(401);
    const bad = await licenseCall(app, "gr_deadbeefdeadbeefdead_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")("GET", "/me");
    expect(bad.status).toBe(401);
    expect(bad.json.error.code).toBe("invalid_license");
  });
  it("signs up with email+password and starts on the Free plan", async () => {
    const a = await signUp(app, "free");
    const me = await a.call("GET", "/me");
    expect(me.status).toBe(200);
    expect(me.json.plan).toBe("free");
    expect(me.json.usage.weeklyLimit).toBe(5);
  });
  it("blocks cross-origin cookie-authenticated mutations", async () => {
    const a = await signUp(app, "csrf");
    const r = await a.call("PUT", "/profile", { skills: ["x"] }, { origin: "https://evil.example" });
    expect(r.status).toBe(403);
  });
});

describe("Free tier: radar only, 5 scored matches / week, license-gated extension", () => {
  let a: Awaited<ReturnType<typeof signUp>>;
  let key = "";
  it("loads fixture jobs: 5 scored, the rest captured but locked", async () => {
    a = await signUp(app, "quota");
    const seed = await a.call("POST", "/demo/seed", {});
    expect(seed.status).toBe(200);
    expect(seed.json.profileSeeded).toBe(true);
    expect(seed.json.items).toHaveLength(11);
    expect(seed.json.items.filter((i: any) => !i.locked)).toHaveLength(5);
    expect(seed.json.items.filter((i: any) => i.locked)).toHaveLength(6);
    expect(seed.json.quota).toEqual({ limit: 5, used: 5, remaining: 0 });
    const list = await a.call("GET", "/matches");
    expect(list.json.matches).toHaveLength(5);
    expect(list.json.lockedJobs).toBe(6);
  });
  it("mints a license and the extension can use it", async () => {
    const lic = await a.call("GET", "/license");
    expect(lic.json.licenses).toHaveLength(1);
    expect(lic.json.licenses[0].keyPreview).toMatch(/^gr_[0-9a-f]{4}….{4}$/);
    expect(JSON.stringify(lic.json)).not.toMatch(/gr_[0-9a-f]{20}_/); // listing never contains the full key
    const rev = await a.call("POST", `/license/${lic.json.licenses[0].id}/reveal`);
    key = rev.json.key;
    expect(key).toMatch(/^gr_[0-9a-f]{20}_[A-Za-z0-9_-]{32}$/);
    const call = licenseCall(app, key);
    const me = await call("GET", "/me");
    expect(me.status).toBe(200);
    expect(me.json.via).toBe("license");
    expect(me.json.user.id).toBe(a.userId);
  });
  it("extension ingest respects the quota: re-seen jobs re-score for free, new ones lock", async () => {
    const call = licenseCall(app, key);
    const again = await call("POST", "/jobs", {
      jobs: [
        { source: "fixture", externalId: "fx-1001", url: `${APP_URL}/demo-board/jobs/fx-1001`, title: "Rebuild our SaaS analytics dashboard in Next.js + TypeScript", skills: ["Next.js", "TypeScript"] },
        { source: "upwork", url: "https://www.upwork.com/jobs/~01abc", title: "New React task", description: "React and TypeScript", skills: ["React"] },
      ],
    });
    expect(again.status).toBe(200);
    expect(again.json.items[1].locked).toBe(true);
    expect(again.json.items[1].score).toBeNull();
    expect(again.json.plan).toBe("free");
  });
  it("validates ingest payloads (no javascript: URLs, bounded batch)", async () => {
    const call = licenseCall(app, key);
    const bad = await call("POST", "/jobs", { jobs: [{ source: "upwork", url: "javascript:alert(1)", title: "x" }] });
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe("invalid_request");
    const empty = await call("POST", "/jobs", { jobs: [] });
    expect(empty.status).toBe(400);
  });
  it("gates paid features: drafts and digest return 402", async () => {
    const list = await a.call("GET", "/matches");
    const id = list.json.matches[0].id;
    const d = await a.call("POST", `/matches/${id}/draft`);
    expect(d.status).toBe(402);
    expect(d.json.error.code).toBe("plan_required");
    const dg = await a.call("POST", "/digest/send");
    expect(dg.status).toBe(402);
  });
  it("rotating a key invalidates the old one; revoking kills the new one", async () => {
    const lic = await a.call("GET", "/license");
    const id = lic.json.licenses[0].id;
    const rot = await a.call("POST", `/license/${id}/rotate`);
    expect((await licenseCall(app, key)("GET", "/me")).status).toBe(401);
    expect((await licenseCall(app, rot.json.key)("GET", "/me")).status).toBe(200);
    await a.call("DELETE", `/license/${id}`);
    expect((await licenseCall(app, rot.json.key)("GET", "/me")).status).toBe(401);
  });
  it("tampered signature is rejected", async () => {
    const b = await signUp(app, "tamper");
    const lic = await b.call("GET", "/license");
    const k = (await b.call("POST", `/license/${lic.json.licenses[0].id}/reveal`)).json.key as string;
    const forged = k.slice(0, -1) + (k.endsWith("A") ? "B" : "A");
    expect((await licenseCall(app, forged)("GET", "/me")).status).toBe(401);
  });
});

describe("Pro: drafts, upgrade re-scoring, digest", () => {
  let a: Awaited<ReturnType<typeof signUp>>;
  it("upgrade unlocks everything: rescore scores the locked jobs", async () => {
    a = await signUp(app, "pro");
    await a.call("POST", "/demo/seed", {});
    expect((await a.call("GET", "/matches")).json.matches).toHaveLength(5);
    const up = await a.call("POST", "/billing/dev-upgrade", { plan: "pro" });
    expect(up.json.plan).toBe("pro");
    const rs = await a.call("POST", "/matches/rescore");
    expect(rs.json.newlyScored).toBe(6);
    expect(rs.json.stillLocked).toBe(0);
    const list = await a.call("GET", "/matches");
    expect(list.json.matches).toHaveLength(11);
    expect(list.json.matches[0].score).toBeGreaterThanOrEqual(90);
    expect(list.json.matches[0].job.title).toMatch(/Next\.js/);
  });
  it("falls back to the template draft when the LLM returns garbage", async () => {
    llmMode = "garbage";
    const top = (await a.call("GET", "/matches")).json.matches[0];
    const r = await a.call("POST", `/matches/${top.id}/draft`);
    expect(r.status).toBe(200);
    expect(r.json.draft.generatedBy).toBe("template-fallback");
    expect(r.json.draft.milestones).toHaveLength(3);
    expect(r.json.draft.youStillMust.join(" ")).toMatch(/Submit the proposal yourself/);
  });
  it("uses the LLM when it behaves and versions each draft", async () => {
    llmMode = "valid";
    const top = (await a.call("GET", "/matches")).json.matches[0];
    const r = await a.call("POST", `/matches/${top.id}/draft`);
    expect(r.json.draft.generatedBy).toBe("stub:model-1");
    expect(r.json.draft.version).toBe(2);
    expect(r.json.draft.milestones.reduce((s: number, m: any) => s + m.percentOfBudget, 0)).toBe(100);
    const detail = await a.call("GET", `/matches/${top.id}`);
    expect(detail.json.draft.version).toBe(2);
    expect(detail.json.status).toBe("drafted");
  });
  it("strips links an injected listing might smuggle into the draft", async () => {
    llmMode = "evil";
    const top = (await a.call("GET", "/matches")).json.matches[0];
    const r = await a.call("POST", `/matches/${top.id}/draft`);
    expect(r.json.draft.coverLetter).not.toContain("evil.test");
    expect(r.json.draft.coverLetter).toContain("[link removed]");
  });
  it("falls back when the provider throws", async () => {
    llmMode = "throws";
    const top = (await a.call("GET", "/matches")).json.matches[1];
    const r = await a.call("POST", `/matches/${top.id}/draft`);
    expect(r.status).toBe(200);
    expect(r.json.draft.generatedBy).toBe("template-fallback");
  });
  it("sends a digest with score, draft, checklist and the human submission link; then has nothing new", async () => {
    llmMode = "valid";
    sent.length = 0;
    const prev = await a.call("GET", "/digest/preview");
    expect(prev.status).toBe(200);
    expect(prev.json.itemCount).toBeGreaterThan(0);
    const r = await a.call("POST", "/digest/send");
    expect(r.json.status).toBe("sent");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(a.email);
    expect(sent[0]!.html).toContain("What you still must do");
    expect(sent[0]!.html).toContain("/demo-board/jobs/fx-1001");
    expect(sent[0]!.html).toContain("We never submit proposals on your behalf");
    expect(sent[0]!.subject).toMatch(/gigs? fit you/);
    // the first digest is capped at 5 items; everything already digested is marked so it is never sent twice
    const rows1 = await ctx.db.select().from(digests).where(eq(digests.userId, a.userId));
    expect(rows1).toHaveLength(1);
    expect(rows1[0]!.matchIds).toHaveLength(5);
    const digested = await ctx.db.select().from(matches).where(eq(matches.userId, a.userId));
    expect(digested.filter((m) => m.digestedAt).length).toBe(5);

    // second digest carries the remaining eligible matches (score >= 60, not excluded) and nothing is repeated
    const second = await a.call("POST", "/digest/send");
    expect(second.json.status).toBe("sent");
    const rows2 = await ctx.db.select().from(digests).where(eq(digests.userId, a.userId));
    const all = rows2.flatMap((d) => d.matchIds);
    expect(new Set(all).size).toBe(all.length);

    // third: nothing new
    const third = await a.call("POST", "/digest/send");
    expect(third.json.status).toBe("skipped");
    const log = await a.call("GET", "/digests");
    expect(log.json.digests[0].status).toBe("sent");
    expect(log.json.digests).toHaveLength(2);
  });
  it("never digests disqualified (excluded keyword) matches", async () => {
    const list = (await a.call("GET", "/matches")).json.matches as any[];
    const dq = list.filter((m) => m.disqualified);
    expect(dq.length).toBeGreaterThanOrEqual(2);
    const rows = await ctx.db.select().from(digests).where(eq(digests.userId, a.userId));
    for (const id of rows.flatMap((d) => d.matchIds)) expect(dq.some((m) => m.id === id)).toBe(false);
  });
  it("editing the profile re-scores existing jobs", async () => {
    const before = (await a.call("GET", "/matches")).json.matches.find((m: any) => /LLM-powered/.test(m.job.title)).score;
    const prof = (await a.call("GET", "/profile")).json;
    const put = await a.call("PUT", "/profile", { ...prof.profile, skills: ["Photoshop", "Illustrator"], digestEnabled: true, digestMinScore: 60 });
    expect(put.status).toBe(200);
    expect(put.json.rescore.rescored).toBe(11);
    const after = (await a.call("GET", "/matches")).json.matches.find((m: any) => /LLM-powered/.test(m.job.title)).score;
    expect(after).toBeLessThan(before);
  });
  it("stores an outbox digest when no mail provider is configured", async () => {
    const noMail = await makeCtx({ llm: null, mailer: null });
    const app2 = makeApp(noMail);
    const b = await signUp(app2, "outbox");
    await b.call("POST", "/demo/seed", {});
    await b.call("POST", "/billing/dev-upgrade", { plan: "pro" });
    await b.call("POST", "/matches/rescore");
    const r = await b.call("POST", "/digest/send");
    expect(r.json.status).toBe("outbox");
    const log = await b.call("GET", "/digests");
    const full = await b.call("GET", `/digests/${log.json.digests[0].id}`);
    expect(full.json.html).toContain("Open listing &amp; submit yourself");
    await noMail.close();
  });
  it("cron digest requires the secret", async () => {
    const noKey = await app.request(`${APP_URL}/api/cron/digest`);
    expect(noKey.status).toBe(401);
    const bad = await app.request(`${APP_URL}/api/cron/digest`, { headers: { authorization: "Bearer nope" } });
    expect(bad.status).toBe(401);
    const ok = await app.request(`${APP_URL}/api/cron/digest`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    expect(ok.status).toBe(200);
    const j = (await ok.json()) as any;
    expect(j).toHaveProperty("users");
  });
});

describe("Stripe webhook → entitlement → license", () => {
  const stripe = stripeForTests();
  it("rejects bad or missing signatures", async () => {
    const r1 = await app.request(`${APP_URL}/api/stripe/webhook`, { method: "POST", body: "{}" });
    expect(r1.status).toBe(400);
    const r2 = await app.request(`${APP_URL}/api/stripe/webhook`, { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=bad" } });
    expect(r2.status).toBe(400);
  });
  it("subscription.created activates Pro, mints a license, is idempotent; deleted drops to Free", async () => {
    const a = await signUp(app, "stripe");
    expect((await a.call("GET", "/me")).json.plan).toBe("free");
    const sub = subscriptionObject({ id: "sub_test_1", userId: a.userId, lookupKey: "gigradar_pro_monthly" });
    const evt = { id: "evt_1", object: "event", type: "customer.subscription.created", data: { object: sub } };
    const { payload, header } = signedWebhook(stripe, evt);
    const r = await app.request(`${APP_URL}/api/stripe/webhook`, { method: "POST", body: payload, headers: { "stripe-signature": header } });
    expect(r.status).toBe(200);
    expect(((await r.json()) as any).duplicate).toBe(false);

    const me = await a.call("GET", "/me");
    expect(me.json.plan).toBe("pro");
    expect(me.json.subscription.hasBillingAccount).toBe(true);
    expect((await ctx.db.select().from(licenses).where(eq(licenses.userId, a.userId))).length).toBe(1);

    const replay = await app.request(`${APP_URL}/api/stripe/webhook`, { method: "POST", body: payload, headers: { "stripe-signature": header } });
    expect(((await replay.json()) as any).duplicate).toBe(true);

    const del = signedWebhook(stripe, { id: "evt_2", object: "event", type: "customer.subscription.deleted", data: { object: { ...sub, status: "canceled" } } });
    await app.request(`${APP_URL}/api/stripe/webhook`, { method: "POST", body: del.payload, headers: { "stripe-signature": del.header } });
    expect((await a.call("GET", "/me")).json.plan).toBe("free");
  });
  it("an upgrade scores the listings that were locked while the Free quota was spent", async () => {
    const a = await signUp(app, "unlock");
    await a.call("POST", "/demo/seed", {});
    const before = await a.call("GET", "/me");
    expect(before.json.plan).toBe("free");
    expect(before.json.lockedJobs).toBe(6);
    const sub = subscriptionObject({ id: "sub_unlock", userId: a.userId, lookupKey: "gigradar_pro_monthly" });
    const w = signedWebhook(stripe, { id: "evt_unlock", object: "event", type: "customer.subscription.created", data: { object: sub } });
    const r = await app.request(`${APP_URL}/api/stripe/webhook`, { method: "POST", body: w.payload, headers: { "stripe-signature": w.header } });
    expect(r.status).toBe(200);
    const after = await a.call("GET", "/me");
    expect(after.json.plan).toBe("pro");
    expect(after.json.lockedJobs).toBe(0);
    expect((await a.call("GET", "/matches")).json.matches.length).toBe(11);
  });
  it("checkout.session.completed fetches the subscription and activates Studio", async () => {
    const a = await signUp(app, "studio");
    const sub = subscriptionObject({ id: "sub_test_2", userId: a.userId, lookupKey: "gigradar_studio_monthly", customer: "cus_test_2" });
    const spy = vi.spyOn(stripe.subscriptions, "retrieve").mockResolvedValue(sub as any);
    const ctx2 = await makeCtx({ stripe, llm: null, mailer: null });
    // reuse the same DB-less context but with the stub: build a second app over a fresh context
    const app2 = makeApp(ctx2);
    const b = await signUp(app2, "studio2");
    const sub2 = subscriptionObject({ id: "sub_test_3", userId: b.userId, lookupKey: "gigradar_studio_monthly", customer: "cus_test_3" });
    spy.mockResolvedValue(sub2 as any);
    const evt = { id: "evt_3", object: "event", type: "checkout.session.completed", data: { object: { id: "cs_test_1", object: "checkout.session", mode: "subscription", subscription: "sub_test_3", client_reference_id: b.userId, metadata: { userId: b.userId } } } };
    const { payload, header } = signedWebhook(stripe, evt);
    const r = await app2.request(`${APP_URL}/api/stripe/webhook`, { method: "POST", body: payload, headers: { "stripe-signature": header } });
    expect(r.status).toBe(200);
    expect((await b.call("GET", "/me")).json.plan).toBe("studio");
    spy.mockRestore();
    await ctx2.close();
    void a;
  });
  it("past_due keeps access (grace); unpaid/canceled does not", async () => {
    const a = await signUp(app, "pastdue");
    const mk = (id: string, status: string) => signedWebhook(stripe, { id, object: "event", type: "customer.subscription.updated", data: { object: subscriptionObject({ id: "sub_pd", userId: a.userId, lookupKey: "gigradar_pro_monthly", status }) } });
    for (const [id, status, expected] of [["evt_pd1", "past_due", "pro"], ["evt_pd2", "unpaid", "free"]] as const) {
      const w = mk(id, status);
      await app.request(`${APP_URL}/api/stripe/webhook`, { method: "POST", body: w.payload, headers: { "stripe-signature": w.header } });
      expect((await a.call("GET", "/me")).json.plan).toBe(expected);
    }
  });
  it("checkout requires billing config and a valid plan", async () => {
    const a = await signUp(app, "checkout");
    expect((await a.call("POST", "/billing/checkout", { plan: "gold" })).status).toBe(400);
  });
  it("dev-upgrade is disabled when allowDevUpgrade is false (production)", async () => {
    const prod = await makeCtx({ llm: null, mailer: null });
    prod.config.allowDevUpgrade = false;
    const app2 = makeApp(prod);
    const b = await signUp(app2, "prod");
    expect((await b.call("POST", "/billing/dev-upgrade", { plan: "pro" })).status).toBe(404);
    await prod.close();
  });
});

describe("Seats and the Studio work bench", () => {
  it("Pro has 1 seat; Studio has 5", async () => {
    const a = await signUp(app, "seats");
    await a.call("POST", "/billing/dev-upgrade", { plan: "pro" });
    await a.call("GET", "/license");
    const second = await a.call("POST", "/license", { label: "Laptop" });
    expect(second.status).toBe(409);
    expect(second.json.error.code).toBe("seat_limit");
    await a.call("POST", "/billing/dev-upgrade", { plan: "studio" });
    for (let i = 0; i < 4; i++) expect((await a.call("POST", "/license", { label: `Seat ${i}` })).status).toBe(201);
    expect((await a.call("POST", "/license", { label: "Too many" })).status).toBe(409);
    expect((await a.call("GET", "/license")).json.licenses).toHaveLength(5);
  });
  it("work bench is Studio-only and needs a won gig", async () => {
    const a = await signUp(app, "wb");
    await a.call("POST", "/demo/seed", {});
    await a.call("POST", "/billing/dev-upgrade", { plan: "pro" });
    await a.call("POST", "/matches/rescore");
    const top = (await a.call("GET", "/matches")).json.matches[0];
    expect((await a.call("POST", `/matches/${top.id}/workbench`, { kind: "kickoff" })).json.error.code).toBe("plan_required");
    await a.call("POST", "/billing/dev-upgrade", { plan: "studio" });
    expect((await a.call("POST", `/matches/${top.id}/workbench`, { kind: "kickoff" })).json.error.code).toBe("not_won");
    await a.call("PATCH", `/matches/${top.id}`, { status: "won" });
    llmMode = "garbage"; // workbench output is free text; garbage-but-long text is accepted, short falls back
    const r = await a.call("POST", `/matches/${top.id}/workbench`, { kind: "kickoff" });
    expect(r.status).toBe(200);
    expect(r.json.item.generatedBy).toBe("template-fallback");
    expect(r.json.item.content).toMatch(/MESSAGE TO CLIENT/);
    expect((await a.call("POST", `/matches/${top.id}/workbench`, { kind: "nope" })).status).toBe(400);
    const detail = await a.call("GET", `/matches/${top.id}`);
    expect(detail.json.workbench).toHaveLength(1);
  });
});

describe("Privacy: export and delete", () => {
  it("exports data without secrets, then deletes everything and revokes access", async () => {
    const a = await signUp(app, "gdpr");
    await a.call("POST", "/demo/seed", {});
    const lic = await a.call("GET", "/license");
    const key = (await a.call("POST", `/license/${lic.json.licenses[0].id}/reveal`)).json.key;

    const exp = await a.call("GET", "/account/export");
    expect(exp.status).toBe(200);
    expect(exp.json.jobs).toHaveLength(11);
    expect(exp.json.matches.length).toBeGreaterThan(0);
    expect(JSON.stringify(exp.json)).not.toMatch(/gr_[0-9a-f]{20}_/);
    expect(JSON.stringify(exp.json)).not.toMatch(/password/i);

    expect((await a.call("DELETE", "/account", { confirm: "no" })).status).toBe(400);
    const del = await a.call("DELETE", "/account", { confirm: "DELETE" });
    expect(del.status).toBe(200);

    expect((await licenseCall(app, key)("GET", "/me")).status).toBe(401);
    expect((await a.call("GET", "/me")).status).toBe(401);
    expect(await ctx.db.select().from(user).where(eq(user.id, a.userId))).toHaveLength(0);
    expect(await ctx.db.select().from(matches).where(eq(matches.userId, a.userId))).toHaveLength(0);
    const trail = await ctx.db.select().from(auditEvents).where(eq(auditEvents.type, "account.deleted"));
    expect(trail.some((t) => (t.meta as any).userId === a.userId)).toBe(true);
    expect(await ctx.db.select().from(subscriptions).where(eq(subscriptions.userId, a.userId))).toHaveLength(0);
  });
});
