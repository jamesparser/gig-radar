/** `npm run db:migrate` — apply embedded migrations to DATABASE_URL (Neon/Supabase/any Postgres). */
import { createDb, migrate } from "../src/db/client";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to a postgres:// connection string.");
  process.exit(1);
}
const h = await createDb({ url });
const { applied } = await migrate(h.db);
console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
await h.close();
