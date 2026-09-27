import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http-error";

/**
 * Sign-in for the native app (PKCE-style hand-off).
 *
 * 1. The app opens /api/mobile/start?challenge=S256(verifier)&redirect=fitlens://auth in a browser.
 * 2. The user signs in on the web with the normal Google flow.
 * 3. The server redirects back to the app with a short-lived signed `code` bound to the challenge.
 * 4. The app POSTs { code, verifier } to /api/mobile/token and gets a session token for
 *    `Authorization: Bearer`. The token is a row in the same `sessions` table the web uses.
 *
 * A code caught by another app is useless without the verifier, which never leaves the device.
 */

const CODE_TTL_MS = 2 * 60 * 1000;
export const MOBILE_SESSION_DAYS = 90;

/** Where the hand-off may send the code: the app's scheme, or Expo Go while developing. */
const ALLOWED_SCHEMES = ["fitlens:", "exp:", "exps:"];

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new HttpError(500, "AUTH_SECRET is not set");
  return s;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function isAllowedRedirect(redirect: string): boolean {
  try {
    return ALLOWED_SCHEMES.includes(new URL(redirect).protocol);
  } catch {
    return false;
  }
}

/** A challenge is base64url(sha256(verifier)): 43 characters. */
export function isChallenge(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function signCode(userId: string, challenge: string, now = Date.now()): string {
  const payload = b64url(Buffer.from(JSON.stringify({ u: userId, c: challenge, e: now + CODE_TTL_MS })));
  const sig = b64url(createHmac("sha256", secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

/** Returns the user id when the code is genuine, unexpired and matches the verifier. */
export function redeemCode(code: string, verifier: string, now = Date.now()): string {
  const [payload, sig] = code.split(".");
  if (!payload || !sig) throw new HttpError(400, "Bad sign-in code");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(400, "Bad sign-in code");
  }
  const { u, c, e } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
    u: string;
    c: string;
    e: number;
  };
  if (now > e) throw new HttpError(400, "Sign-in code expired, try again");
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  if (challenge !== c) throw new HttpError(400, "Bad sign-in code");
  return u;
}

export async function createMobileSession(userId: string) {
  const sessionToken = b64url(randomBytes(32));
  const expires = new Date(Date.now() + MOBILE_SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { sessionToken, userId, expires } });
  return { token: sessionToken, expires: expires.toISOString() };
}

/** User id for an `Authorization: Bearer <token>` header, or null. */
export async function userIdFromBearer(header: string | null): Promise<string | null> {
  const token = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    select: { userId: true, expires: true },
  });
  return session && session.expires > new Date() ? session.userId : null;
}

export function bearerToken(header: string | null): string | null {
  return header?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}
