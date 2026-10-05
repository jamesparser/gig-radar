import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Config } from "./config";
import type { Db } from "./db/client";
import { account, session, user, verification } from "./db/schema";

/**
 * Authentication via Better Auth: email + password and (optionally) GitHub OAuth.
 * Sessions are HTTP-only cookies (SameSite=Lax, Secure in production). Passwords are scrypt-hashed by the library.
 *
 * Production hardening to add after the hackathon: email verification (needs the mail provider on a verified domain),
 * 2FA plugin, and org/team support for Studio seats.
 */
export function createAuth(db: Db, config: Config) {
  return betterAuth({
    appName: "GigRadar",
    baseURL: config.appUrl,
    secret: config.authSecret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    socialProviders: config.github
      ? { github: { clientId: config.github.clientId, clientSecret: config.github.clientSecret } }
      : {},
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    trustedOrigins: [config.appUrl],
    advanced: { useSecureCookies: config.isProd },
  });
}

export type Auth = ReturnType<typeof createAuth>;
