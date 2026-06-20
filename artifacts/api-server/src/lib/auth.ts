import { timingSafeEqual, createHash } from "crypto";

/**
 * Constant-time comparison of a provided secret against SESSION_SECRET.
 * Prevents timing attacks on admin endpoints.
 */
export function verifySecret(provided: string | undefined): boolean {
  const expected = process.env.SESSION_SECRET || "";
  if (!provided || !expected) return false;
  try {
    const a = createHash("sha256").update(provided).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
