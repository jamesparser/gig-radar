import Stripe from "stripe";
import { createAuth, type Auth } from "./auth";
import { loadConfig, type Config } from "./config";
import { createDb, migrate, type Db } from "./db/client";
import { createLlm, type LlmProvider } from "./providers/llm";
import { createMailer, type Mailer } from "./providers/mailer";

export interface Ctx {
  config: Config;
  db: Db;
  dbKind: "postgres" | "pglite";
  auth: Auth;
  llm: LlmProvider | null;
  mailer: Mailer | null;
  stripe: Stripe | null;
  now: () => Date;
  close: () => Promise<void>;
}

export interface ContextOverrides {
  llm?: LlmProvider | null;
  mailer?: Mailer | null;
  stripe?: Stripe | null;
  now?: () => Date;
}

export async function createContext(config: Config = loadConfig(), overrides: ContextOverrides = {}): Promise<Ctx> {
  const handle = await createDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
  if (config.autoMigrate) await migrate(handle.db);
  const auth = createAuth(handle.db, config);
  return {
    config,
    db: handle.db,
    dbKind: handle.kind,
    auth,
    llm: overrides.llm !== undefined ? overrides.llm : createLlm(config),
    mailer: overrides.mailer !== undefined ? overrides.mailer : createMailer(config),
    stripe:
      overrides.stripe !== undefined
        ? overrides.stripe
        : config.stripe
          ? new Stripe(config.stripe.secretKey, { appInfo: { name: "GigRadar", version: "0.1.0" } })
          : null,
    now: overrides.now ?? (() => new Date()),
    close: handle.close,
  };
}

const KEY = Symbol.for("gigradar.ctx");
type G = typeof globalThis & { [KEY]?: Promise<Ctx> };

/** Process-wide singleton (survives Next.js dev hot reloads and is reused across warm serverless invocations). */
export function getContext(): Promise<Ctx> {
  const g = globalThis as G;
  if (!g[KEY]) {
    g[KEY] = createContext().catch((err) => {
      delete g[KEY]; // don't cache a failed boot
      throw err;
    });
  }
  return g[KEY]!;
}
