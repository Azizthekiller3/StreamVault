import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  return process.env.SESSION_SECRET || "dev-fallback-secret";
}

/** Derive a static admin token from SESSION_SECRET. Cannot be forged without the secret. */
export function generateAdminToken(): string {
  return createHmac("sha256", secret()).update("flixnest-admin-v1").digest("hex");
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = generateAdminToken();
  try {
    if (token.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  // If explicit credentials are set, use them; otherwise fall back to admin / SESSION_SECRET
  const eu = process.env.ADMIN_USERNAME || "admin";
  const ep = process.env.ADMIN_PASSWORD || process.env.SESSION_SECRET || "";
  if (!ep) return false;
  try {
    const pad = (a: string, b: string) =>
      [Buffer.from(a.padEnd(b.length, "\0")), Buffer.from(b.padEnd(a.length, "\0"))];
    const [ub, eb] = pad(username, eu);
    const [pb, epb] = pad(password, ep);
    return timingSafeEqual(ub, eb) && timingSafeEqual(pb, epb) &&
           username.length === eu.length && password.length === ep.length;
  } catch {
    return false;
  }
}

