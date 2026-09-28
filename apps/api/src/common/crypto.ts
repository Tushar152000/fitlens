import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (buf: Buffer) => buf.toString("base64url");

/** A tamper-proof, expiring token: base64url(JSON payload) + "." + HMAC-SHA256. Not encrypted — don't put secrets in it. */
export function signPayload<T extends object>(
  secret: string,
  payload: T,
  ttlMs: number,
  now = Date.now(),
): string {
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, exp: now + ttlMs })));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export type VerifyResult<T> =
  { ok: true; payload: T } | { ok: false; reason: "invalid" | "expired" };

export function verifyPayload<T>(secret: string, token: string, now = Date.now()): VerifyResult<T> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "invalid" };
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return { ok: false, reason: "invalid" };
  let parsed: T & { exp: number };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof parsed.exp !== "number" || now > parsed.exp) return { ok: false, reason: "expired" };
  return { ok: true, payload: parsed };
}
