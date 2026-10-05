"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, Notice } from "./ui";

function GithubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

const inputCls =
  "h-11 w-full rounded-lg border border-line-strong bg-bg/70 px-3.5 text-[15px] text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";

export function AuthForm({ mode, githubEnabled }: { mode: "login" | "signup"; githubEnabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    const name = String(f.get("name") ?? "").trim();
    try {
      const res = isSignup
        ? await authClient.signUp.email({ name: name || email.split("@")[0]!, email, password, callbackURL: "/dashboard" })
        : await authClient.signIn.email({ email, password, callbackURL: "/dashboard" });
      if (res.error) {
        setError(res.error.message ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <h1 className="text-2xl font-semibold tracking-tight">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-1.5 text-sm text-muted">{isSignup ? "Free plan: 5 scored matches a week. No card needed." : "Sign in to your radar."}</p>

      {githubEnabled ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="mt-6 w-full"
            onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/dashboard" })}
          >
            <GithubMark /> Continue with GitHub
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
        </>
      ) : (
        <div className="mt-6" />
      )}

      <form onSubmit={onSubmit} className="space-y-3.5">
        {isSignup ? (
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-muted">Name</span>
            <input name="name" autoComplete="name" required className={inputCls} placeholder="Alex Rivera" />
          </label>
        ) : null}
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-muted">Email</span>
          <input name="email" type="email" autoComplete="email" required className={inputCls} placeholder="you@example.com" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-muted">Password</span>
          <input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} required minLength={8} className={inputCls} placeholder="At least 8 characters" />
        </label>
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isSignup ? (
          <>Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link></>
        ) : (
          <>New here? <Link href="/signup" className="text-accent hover:underline">Create an account</Link></>
        )}
      </p>
      <p className="mt-4 text-center text-xs text-faint">
        By continuing you agree to the <Link href="/privacy" className="underline-offset-2 hover:underline">privacy &amp; governance</Link> notes.
      </p>
    </div>
  );
}
