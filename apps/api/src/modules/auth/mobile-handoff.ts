import { createHash } from "node:crypto";
import { AppError } from "../../common/errors.js";
import { signPayload, verifyPayload } from "../../common/crypto.js";

/**
 * Sign-in for the native app (PKCE-style hand-off).
 *
 * 1. The app opens /api/mobile/start?challenge=S256(verifier)&redirect=fitlens://auth in a browser.
 * 2. The user signs in with Google.
 * 3. The server redirects back to the app with a short-lived signed `code` bound to the challenge.
 * 4. The app POSTs { code, verifier } to /api/mobile/token and gets a session token for `Authorization: Bearer`.
 *
 * A code caught by another app is useless without the verifier, which never leaves the device.
 */

const CODE_TTL_MS = 2 * 60 * 1000;

/** Where the hand-off may send the code: the app's scheme, or Expo Go while developing. */
const ALLOWED_SCHEMES = ["fitlens:", "exp:", "exps:"];

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

export function signCode(
  secret: string,
  userId: string,
  challenge: string,
  now = Date.now(),
): string {
  return signPayload(secret, { u: userId, c: challenge }, CODE_TTL_MS, now);
}

/** Returns the user id when the code is genuine, unexpired and matches the verifier. */
export function redeemCode(
  secret: string,
  code: string,
  verifier: string,
  now = Date.now(),
): string {
  const result = verifyPayload<{ u: string; c: string }>(secret, code, now);
  if (!result.ok) {
    throw new AppError(
      400,
      result.reason === "expired" ? "Sign-in code expired, try again" : "Bad sign-in code",
    );
  }
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  if (challenge !== result.payload.c) throw new AppError(400, "Bad sign-in code");
  return result.payload.u;
}
