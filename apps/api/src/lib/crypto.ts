import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export const newId = () => randomUUID();
export const randomHex = (bytes: number) => randomBytes(bytes).toString("hex");

const b64url = (buf: Buffer) => buf.toString("base64url");

/** HMAC signature for a license: derived, never stored. */
export function licenseSignature(secret: string, id: string, version: number): string {
  return b64url(createHmac("sha256", secret).update(`gigradar-license:${id}.${version}`).digest()).slice(0, 32);
}

export function formatLicenseKey(secret: string, id: string, version: number): string {
  return `gr_${id}_${licenseSignature(secret, id, version)}`;
}

export interface ParsedKey {
  id: string;
  sig: string;
}

export function parseLicenseKey(raw: string): ParsedKey | null {
  const m = /^gr_([0-9a-f]{20})_([A-Za-z0-9_-]{32})$/.exec(raw.trim());
  return m ? { id: m[1]!, sig: m[2]! } : null;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function maskKey(key: string): string {
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}
