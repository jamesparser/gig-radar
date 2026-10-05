import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const prodSecrets = { NODE_ENV: "production", BETTER_AUTH_SECRET: "s".repeat(32), LICENSE_SECRET: "l".repeat(32) };

describe("loadConfig production guards", () => {
  it("refuses to boot in production without signing secrets", () => {
    expect(() => loadConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://x" })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => loadConfig({ NODE_ENV: "production", BETTER_AUTH_SECRET: "x", DATABASE_URL: "postgres://x" })).toThrow(/LICENSE_SECRET/);
  });

  it("refuses to boot in production on an in-memory database", () => {
    expect(() => loadConfig(prodSecrets)).toThrow(/DATABASE_URL/);
  });

  it("boots in production with a database, a persistent PGlite dir, or an explicit ephemeral opt-in", () => {
    expect(loadConfig({ ...prodSecrets, DATABASE_URL: "postgres://u:p@h/db" }).databaseUrl).toBe("postgres://u:p@h/db");
    expect(loadConfig({ ...prodSecrets, PGLITE_DIR: "/data/pg" }).pgliteDir).toBe("/data/pg");
    expect(() => loadConfig({ ...prodSecrets, ALLOW_EPHEMERAL_DB: "1" })).not.toThrow();
  });

  it("never allows the dev plan switch in production, and allows it in development", () => {
    expect(loadConfig({ ...prodSecrets, DATABASE_URL: "postgres://x" }).allowDevUpgrade).toBe(false);
    expect(loadConfig({}).allowDevUpgrade).toBe(true);
  });

  it("picks the LLM provider from the keys that are present", () => {
    expect(loadConfig({}).llm.provider).toBe("none");
    expect(loadConfig({ ANTHROPIC_API_KEY: "k" }).llm).toMatchObject({ provider: "anthropic", model: "claude-sonnet-5-5" });
    expect(loadConfig({ LLM_API_KEY: "k", LLM_BASE_URL: "https://openrouter.ai/api/v1/", LLM_MODEL: "m" }).llm).toMatchObject({ provider: "openai", baseUrl: "https://openrouter.ai/api/v1", model: "m" });
  });

  it("derives the public app URL from APP_URL or the Vercel production URL", () => {
    expect(loadConfig({ APP_URL: "https://gigradar.example/" }).appUrl).toBe("https://gigradar.example");
    expect(loadConfig({ VERCEL_PROJECT_PRODUCTION_URL: "gig-radar.vercel.app" }).appUrl).toBe("https://gig-radar.vercel.app");
  });
});
