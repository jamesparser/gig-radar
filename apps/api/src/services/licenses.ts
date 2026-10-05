import { and, asc, eq, isNull } from "drizzle-orm";
import { PLANS } from "@gigradar/core";
import type { Ctx } from "../context";
import { licenses } from "../db/schema";
import { ApiError, notFound } from "../errors";
import { formatLicenseKey, licenseSignature, maskKey, newId, parseLicenseKey, randomHex, safeEqual } from "../lib/crypto";
import type { Principal } from "../types";
import { audit } from "./audit";
import { getEntitlement } from "./entitlements";

export interface LicenseView {
  id: string;
  label: string;
  keyPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

type LicenseRow = typeof licenses.$inferSelect;

const toView = (ctx: Ctx, r: LicenseRow): LicenseView => ({
  id: r.id,
  label: r.label,
  keyPreview: maskKey(formatLicenseKey(ctx.config.licenseSecret, r.id, r.version)),
  createdAt: r.createdAt.toISOString(),
  lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
  revoked: r.revokedAt !== null,
});

export async function listLicenses(ctx: Ctx, userId: string): Promise<LicenseView[]> {
  const rows = await ctx.db.select().from(licenses).where(eq(licenses.userId, userId)).orderBy(asc(licenses.createdAt));
  return rows.map((r) => toView(ctx, r));
}

/** Mint a license (a "seat"). Seats per plan: Free 1, Pro 1, Studio 5. */
export async function createLicense(ctx: Ctx, userId: string, label = "Default"): Promise<{ license: LicenseView; key: string }> {
  const ent = await getEntitlement(ctx, userId);
  const active = await ctx.db
    .select({ id: licenses.id })
    .from(licenses)
    .where(and(eq(licenses.userId, userId), isNull(licenses.revokedAt)));
  const seats = PLANS[ent.plan].seats;
  if (active.length >= seats) {
    throw new ApiError(409, "seat_limit", `Your ${PLANS[ent.plan].name} plan includes ${seats} seat${seats === 1 ? "" : "s"}. Revoke a key or upgrade.`, { seats });
  }
  const id = randomHex(10);
  const [row] = await ctx.db
    .insert(licenses)
    .values({ id, userId, label: label.trim().slice(0, 60) || "Default", version: 1, createdAt: ctx.now() })
    .returning();
  await audit(ctx, userId, "license.minted", { licenseId: id, plan: ent.plan });
  return { license: toView(ctx, row!), key: formatLicenseKey(ctx.config.licenseSecret, id, 1) };
}

/** First active license, minting one if the user has none (idempotent). */
export async function ensureLicense(ctx: Ctx, userId: string): Promise<void> {
  const [existing] = await ctx.db
    .select({ id: licenses.id })
    .from(licenses)
    .where(and(eq(licenses.userId, userId), isNull(licenses.revokedAt)))
    .limit(1);
  if (!existing) await createLicense(ctx, userId, "Default");
}

async function owned(ctx: Ctx, userId: string, id: string): Promise<LicenseRow> {
  const [row] = await ctx.db.select().from(licenses).where(and(eq(licenses.id, id), eq(licenses.userId, userId))).limit(1);
  if (!row) throw notFound("License");
  return row;
}

export async function revealLicense(ctx: Ctx, userId: string, id: string): Promise<string> {
  const row = await owned(ctx, userId, id);
  if (row.revokedAt) throw new ApiError(409, "revoked", "This license has been revoked.");
  await audit(ctx, userId, "license.revealed", { licenseId: id });
  return formatLicenseKey(ctx.config.licenseSecret, row.id, row.version);
}

/** Invalidates the old key immediately (the version is part of the signature). */
export async function rotateLicense(ctx: Ctx, userId: string, id: string): Promise<string> {
  const row = await owned(ctx, userId, id);
  if (row.revokedAt) throw new ApiError(409, "revoked", "This license has been revoked.");
  const version = row.version + 1;
  await ctx.db.update(licenses).set({ version }).where(eq(licenses.id, id));
  await audit(ctx, userId, "license.rotated", { licenseId: id });
  return formatLicenseKey(ctx.config.licenseSecret, id, version);
}

export async function revokeLicense(ctx: Ctx, userId: string, id: string): Promise<void> {
  await owned(ctx, userId, id);
  await ctx.db.update(licenses).set({ revokedAt: ctx.now() }).where(eq(licenses.id, id));
  await audit(ctx, userId, "license.revoked", { licenseId: id });
}

/** The gate for the extension and API. Returns null for malformed, unknown, revoked, rotated or forged keys. */
export async function verifyLicenseKey(ctx: Ctx, rawKey: string): Promise<Principal | null> {
  const parsed = parseLicenseKey(rawKey);
  if (!parsed) return null;
  const [row] = await ctx.db.select().from(licenses).where(eq(licenses.id, parsed.id)).limit(1);
  if (!row || row.revokedAt) return null;
  if (!safeEqual(parsed.sig, licenseSignature(ctx.config.licenseSecret, row.id, row.version))) return null;

  // Touch last_used_at at most every 5 minutes.
  const now = ctx.now();
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > 5 * 60_000) {
    await ctx.db.update(licenses).set({ lastUsedAt: now }).where(eq(licenses.id, row.id));
  }
  const ent = await getEntitlement(ctx, row.userId);
  return { userId: row.userId, plan: ent.plan, via: "license", licenseId: row.id };
}
