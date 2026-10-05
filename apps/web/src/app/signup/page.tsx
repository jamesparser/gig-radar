import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getContext } from "@gigradar/api";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

export default async function Page() {
  if (await getSession()) redirect("/dashboard");
  const ctx = await getContext(); // after getSession(): request-time API already touched, so this page is dynamic
  return (
    <AuthShell>
      <AuthForm mode="signup" githubEnabled={Boolean(ctx.config.github)} />
    </AuthShell>
  );
}
