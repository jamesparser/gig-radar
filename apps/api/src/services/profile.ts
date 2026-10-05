import { eq } from "drizzle-orm";
import { profileSchema, type Profile } from "@gigradar/core";
import { z } from "zod";
import type { Ctx } from "../context";
import { profiles } from "../db/schema";
import { audit } from "./audit";

export const profileUpdateSchema = profileSchema.extend({
  digestEnabled: z.boolean().default(true),
  digestMinScore: z.number().int().min(0).max(100).default(60),
});
export type ProfileUpdate = z.output<typeof profileUpdateSchema>;

export interface StoredProfile {
  exists: boolean;
  profile: Profile;
  digestEnabled: boolean;
  digestMinScore: number;
}

export async function getProfile(ctx: Ctx, userId: string): Promise<StoredProfile> {
  const [row] = await ctx.db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!row) return { exists: false, profile: profileSchema.parse({}), digestEnabled: true, digestMinScore: 60 };
  return {
    exists: true,
    profile: profileSchema.parse({
      headline: row.headline,
      bio: row.bio,
      skills: row.skills,
      niches: row.niches,
      excludeKeywords: row.excludeKeywords,
      hourlyRateFloor: row.hourlyRateFloor,
      minFixedBudget: row.minFixedBudget,
      timezone: row.timezone,
      portfolioLinks: row.portfolioLinks,
      tone: row.tone,
    }),
    digestEnabled: row.digestEnabled,
    digestMinScore: row.digestMinScore,
  };
}

export async function saveProfile(ctx: Ctx, userId: string, input: unknown): Promise<StoredProfile> {
  const p = profileUpdateSchema.parse(input);
  const values = {
    headline: p.headline,
    bio: p.bio,
    skills: p.skills,
    niches: p.niches,
    excludeKeywords: p.excludeKeywords,
    hourlyRateFloor: p.hourlyRateFloor,
    minFixedBudget: p.minFixedBudget,
    timezone: p.timezone,
    portfolioLinks: p.portfolioLinks,
    tone: p.tone,
    digestEnabled: p.digestEnabled,
    digestMinScore: p.digestMinScore,
    updatedAt: ctx.now(),
  };
  await ctx.db
    .insert(profiles)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: profiles.userId, set: values });
  await audit(ctx, userId, "profile.updated", { skills: p.skills.length });
  return getProfile(ctx, userId);
}
