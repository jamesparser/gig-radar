import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getContext, getEntitlement, type Ctx } from "@gigradar/api";
import type { PlanId } from "@gigradar/core";

export async function getSession() {
  // Touch the request first: this marks the route dynamic so it is never prerendered at build time (no env/DB there).
  const h = await headers();
  const ctx = await getContext();
  return ctx.auth.api.getSession({ headers: h });
}

export interface Authed {
  ctx: Ctx;
  userId: string;
  name: string;
  email: string;
  plan: PlanId;
}

/** For server components under /dashboard: redirects to /login when signed out. */
export async function requireUser(): Promise<Authed> {
  const h = await headers(); // request-time API first → dynamic rendering
  const ctx = await getContext();
  const session = await ctx.auth.api.getSession({ headers: h });
  if (!session?.user) redirect("/login");
  const ent = await getEntitlement(ctx, session.user.id);
  return { ctx, userId: session.user.id, name: session.user.name, email: session.user.email, plan: ent.plan };
}
