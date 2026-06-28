import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set — admin access disabled");
  return s;
}

export function generateAdminToken(): string {
  return createHmac("sha256", secret()).update("flixnest-admin-v1").digest("hex");
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  let expected: string;
  try {
    expected = generateAdminToken();
  } catch {
    return false;
  }
  try {
    if (token.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const eu = process.env.ADMIN_USERNAME || "admin";
  let ep: string;
  try {
    ep = process.env.ADMIN_PASSWORD || secret();
  } catch {
    return false;
  }
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
