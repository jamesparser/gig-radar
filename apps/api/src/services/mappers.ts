import { jobInputSchema, type Job } from "@gigradar/core";
import type { jobs } from "../db/schema";

type JobRow = typeof jobs.$inferSelect;

/** DB row -> validated core Job. */
export function rowToJob(row: JobRow): Job {
  return jobInputSchema.parse({
    source: row.source,
    externalId: row.externalId,
    url: row.url,
    title: row.title,
    description: row.description,
    budget: row.budget,
    skills: row.skills,
    client: row.client,
    postedAt: row.postedAt?.toISOString(),
  });
}
