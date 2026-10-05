import type { PlanId } from "@gigradar/core";

/** Who is calling: a signed-in browser session or an extension license key. */
export interface Principal {
  userId: string;
  plan: PlanId;
  via: "session" | "license";
  licenseId?: string;
  email?: string;
  name?: string;
}
