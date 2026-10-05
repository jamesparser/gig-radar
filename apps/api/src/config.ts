export interface Config {
  appUrl: string;
  isProd: boolean;
  databaseUrl?: string;
  pgliteDir?: string;
  autoMigrate: boolean;
  authSecret: string;
  licenseSecret: string;
  github?: { clientId: string; clientSecret: string };
  stripe?: {
    secretKey: string;
    webhookSecret?: string;
    priceIds: { pro?: string; studio?: string };
  };
  email: { resendApiKey?: string; from: string };
  llm: {
    provider: "anthropic" | "openai" | "none";
    apiKey?: string;
    model: string;
    baseUrl: string;
  };
  cronSecret?: string;
  /** Dev-only "simulate upgrade" endpoint. Never available when NODE_ENV=production. */
  allowDevUpgrade: boolean;
}

type Env = Record<string, string | undefined>;

const DEV_SECRET = "dev-only-insecure-secret-do-not-use-in-production";
let warned = false;

export function loadConfig(env: Env = process.env): Config {
  const isProd = env.NODE_ENV === "production";

  const vercelUrl = env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;
  const appUrl = (
    env.APP_URL ??
    env.BETTER_AUTH_URL ??
    env.NEXT_PUBLIC_APP_URL ??
    (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000")
  ).replace(/\/$/, "");

  const need = (name: string, value: string | undefined, why: string): string => {
    if (value) return value;
    if (isProd) throw new Error(`Missing required env var ${name} (${why}). Refusing to start in production with an insecure default.`);
    if (!warned) {
      warned = true;
      console.warn(`[gigradar] ${name} not set — using an insecure development default. Set it before deploying.`);
    }
    return DEV_SECRET;
  };

  const authSecret = need("BETTER_AUTH_SECRET", env.BETTER_AUTH_SECRET ?? env.AUTH_SECRET, "session signing");
  const licenseSecret = need("LICENSE_SECRET", env.LICENSE_SECRET, "license key signing");

  // An embedded in-memory database on a serverless host would silently lose every account on the next cold start.
  if (isProd && !env.DATABASE_URL && !env.PGLITE_DIR && env.ALLOW_EPHEMERAL_DB !== "1") {
    throw new Error(
      "Missing required env var DATABASE_URL (a Postgres connection string, e.g. from Neon or Supabase). Refusing to start in production on an in-memory database. Set ALLOW_EPHEMERAL_DB=1 only for a throwaway demo.",
    );
  }

  const anthropicKey = env.ANTHROPIC_API_KEY;
  const openaiKey = env.LLM_API_KEY ?? env.OPENAI_API_KEY;
  const requested = env.LLM_PROVIDER?.toLowerCase();
  const provider: Config["llm"]["provider"] =
    requested === "anthropic" || requested === "openai" || requested === "none"
      ? requested
      : anthropicKey
        ? "anthropic"
        : openaiKey
          ? "openai"
          : "none";

  return {
    appUrl,
    isProd,
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR || undefined,
    autoMigrate: env.AUTO_MIGRATE !== "0",
    authSecret,
    licenseSecret,
    github:
      env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
        : undefined,
    stripe: env.STRIPE_SECRET_KEY
      ? {
          secretKey: env.STRIPE_SECRET_KEY,
          webhookSecret: env.STRIPE_WEBHOOK_SECRET,
          priceIds: { pro: env.STRIPE_PRICE_PRO, studio: env.STRIPE_PRICE_STUDIO },
        }
      : undefined,
    email: {
      resendApiKey: env.RESEND_API_KEY || undefined,
      from: env.EMAIL_FROM ?? "GigRadar <onboarding@resend.dev>",
    },
    llm: {
      provider,
      apiKey: provider === "anthropic" ? anthropicKey : provider === "openai" ? openaiKey : undefined,
      model:
        env.LLM_MODEL ??
        (provider === "anthropic" ? (env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5") : "gpt-4.1-mini"),
      baseUrl: (env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    },
    cronSecret: env.CRON_SECRET || undefined,
    allowDevUpgrade: !isProd,
  };
}
