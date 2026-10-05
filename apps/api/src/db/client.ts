import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { schema } from "./schema";
import { MIGRATIONS } from "./migrations.generated";

/** Works for both drivers: Postgres (Neon/Supabase/Fly) via postgres-js, and PGlite (embedded Postgres) for dev/tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

export interface DbHandle {
  db: Db;
  kind: "postgres" | "pglite";
  close: () => Promise<void>;
}

export interface DbOptions {
  /** postgres:// connection string (Neon, Supabase, …). When omitted, an embedded PGlite database is used. */
  url?: string;
  /** Directory for persistent PGlite data. Omit for in-memory. */
  pgliteDir?: string;
}

export async function createDb(opts: DbOptions): Promise<DbHandle> {
  if (opts.url) {
    const [{ default: postgres }, { drizzle }] = await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
    ]);
    // Serverless-friendly: tiny pool, and Neon/Supabase poolers don't support prepared statements in transaction mode.
    const client = postgres(opts.url, { max: Number(process.env.DB_POOL_MAX ?? 5), prepare: false, idle_timeout: 20 });
    return { db: drizzle(client, { schema }) as unknown as Db, kind: "postgres", close: () => client.end() };
  }
  const [{ PGlite }, { drizzle }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
  ]);
  const client = new PGlite(opts.pgliteDir);
  await client.waitReady;
  return { db: drizzle(client, { schema }) as unknown as Db, kind: "pglite", close: () => client.close() };
}

function rowsOf(res: unknown): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const r = res as { rows?: Record<string, unknown>[] };
  return r.rows ?? [];
}

/**
 * Applies embedded migrations exactly once, in order, under an advisory lock so concurrent cold starts
 * can't race. Safe to call on every boot.
 */
export async function migrate(db: Db): Promise<{ applied: string[] }> {
  const applied: string[] = [];
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(727274)`);
    await tx.execute(
      sql`create table if not exists gigradar_migrations (id text primary key, applied_at timestamptz not null default now())`,
    );
    const done = new Set(rowsOf(await tx.execute(sql`select id from gigradar_migrations`)).map((r) => String(r.id)));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      for (const stmt of m.statements) await tx.execute(sql.raw(stmt));
      await tx.execute(sql`insert into gigradar_migrations (id) values (${m.id})`);
      applied.push(m.id);
    }
  });
  return { applied };
}

export async function dbHealthy(db: Db): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
