import type { Metadata } from "next";
import { PLANS } from "@gigradar/core";
import { getProfile } from "@gigradar/api";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Skills profile" };

export default async function ProfilePage() {
  const { ctx, userId, plan } = await requireUser();
  const s = await getProfile(ctx, userId);
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Skills profile</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">This is what GigRadar scores every listing against, and what drafts are written from.</p>
      <ProfileForm
        digestAllowed={PLANS[plan].emailDigest}
        initial={{
          headline: s.profile.headline,
          bio: s.profile.bio,
          skills: s.profile.skills,
          niches: s.profile.niches,
          excludeKeywords: s.profile.excludeKeywords,
          hourlyRateFloor: s.profile.hourlyRateFloor,
          minFixedBudget: s.profile.minFixedBudget,
          timezone: s.profile.timezone,
          portfolioLinks: s.profile.portfolioLinks,
          tone: s.profile.tone,
          digestEnabled: s.digestEnabled,
          digestMinScore: s.digestMinScore,
        }}
      />
    </div>
  );
}
