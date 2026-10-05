import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Encrypt/decrypt small JSON values for httpOnly cookies (AES-256-GCM keyed by SESSION_SECRET). */
const key = () => createHash("sha256").update(process.env.SESSION_SECRET?.trim() ?? "").digest();

export const hasSessionSecret = () => !!process.env.SESSION_SECRET?.trim();

export function seal(value: unknown) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(token: string | undefined): T | null {
  if (!token || !hasSessionSecret()) return null;
  try {
    const buf = Buffer.from(token, "base64url");
    const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const secureCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 60,
};
