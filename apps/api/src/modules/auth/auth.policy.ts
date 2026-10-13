import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { safeEqual } from "../../common/crypto.js";

/**
 * Pure sign-in and session rules. No I/O, so every branch is unit-tested (auth.policy.spec.ts).
 */

export const DAY_MS = 86_400_000;
/** How long a Google round trip may take (state cookie lifetime). */
export const SIGN_IN_TTL_MS = 10 * 60_000;
/** How long the app has to redeem its one-time code. */
export const AUTH_CODE_TTL_MS = 2 * 60_000;
/** A session's expiry slides forward at most this often, so authentication is a read, not a write. */
export const SESSION_TOUCH_INTERVAL_MS = DAY_MS;
/** Sign-in history retention. */
export const AUTH_EVENT_RETENTION_MS = 90 * DAY_MS;

const DEFAULT_RETURN_PATH = "/today";

/**
 * Where the web app lands after sign-in: a same-origin path only, so the flow can't be turned into an
 * open redirect. Rejects `//evil`, `/\evil`, absolute URLs and anything that resolves off-origin.
 */
export function safeReturnPath(value: unknown, origin: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || hasUnsafeChars(value)) {
    return DEFAULT_RETURN_PATH;
  }
  try {
    const url = new URL(value, origin);
    if (url.origin !== new URL(origin).origin) return DEFAULT_RETURN_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}

/** Backslashes and control characters: browsers "fix" them in ways that change the target. */
const hasUnsafeChars = (value: string) =>
  value.includes("\\") || [...value].some((c) => c.charCodeAt(0) < 0x20 || c === "\u007f");

/**
 * Where the app hand-off may deliver its one-time code: the app's own scheme, plus Expo Go's
 * `exp://` / `exps://` when not deployed. Never http(s), so a web page can't receive it.
 */
export function isAllowedAppRedirect(value: string, deployed: boolean): boolean {
  const schemes = deployed ? ["fitlens:"] : ["fitlens:", "exp:", "exps:"];
  try {
    return schemes.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** PKCE S256 (RFC 7636 §4.6): base64url(SHA-256(verifier)). */
export const pkceChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");

export const pkceMatches = (verifier: string, challenge: string) =>
  safeEqual(pkceChallenge(verifier), challenge);

/**
 * Privacy-preserving IP for the device list and audit log: IPv4 → /24, IPv6 → /48.
 * IPv4-mapped IPv6 (`::ffff:1.2.3.4`, what Node reports on dual-stack sockets) is treated as IPv4.
 */
export function truncateIp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const ip = raw.startsWith("::ffff:") && isIP(raw.slice(7)) === 4 ? raw.slice(7) : raw;
  const version = isIP(ip);
  if (version === 4) return `${ip.split(".").slice(0, 3).join(".")}.0`;
  if (version === 6) return `${expandIpv6(ip).slice(0, 3).join(":")}::`;
  return null;
}

function expandIpv6(ip: string): string[] {
  const [head, tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail ? tail.split(":") : [];
  const fill = tail !== undefined ? Array(8 - left.length - right.length).fill("0") : [];
  return [...left, ...fill, ...right].map((g) => g.toLowerCase().replace(/^0+(?=.)/, ""));
}

/** Cut a header value to fit its column. */
export const clip = (value: string | undefined | null, max: number): string | null =>
  value ? value.slice(0, max) : null;

export interface SessionClock {
  lastSeenAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

/** Expiry for a session created now: idle window, capped by the hard limit. */
export function initialExpiry(now: Date, idleDays: number, maxDays: number) {
  const absoluteExpiresAt = new Date(now.getTime() + maxDays * DAY_MS);
  const expiresAt = new Date(
    Math.min(now.getTime() + idleDays * DAY_MS, absoluteExpiresAt.getTime()),
  );
  return { expiresAt, absoluteExpiresAt };
}

export const isSessionLive = (s: SessionClock, now: Date) =>
  s.expiresAt > now && s.absoluteExpiresAt > now;

/**
 * Sliding expiry. Returns the new `{ lastSeenAt, expiresAt }` when the session is due a touch
 * (last one over SESSION_TOUCH_INTERVAL_MS ago), else null. Never moves past the hard limit.
 */
export function slideExpiry(
  s: SessionClock,
  now: Date,
  idleDays: number,
): { lastSeenAt: Date; expiresAt: Date } | null {
  if (now.getTime() - s.lastSeenAt.getTime() < SESSION_TOUCH_INTERVAL_MS) return null;
  const expiresAt = new Date(
    Math.min(now.getTime() + idleDays * DAY_MS, s.absoluteExpiresAt.getTime()),
  );
  return { lastSeenAt: now, expiresAt };
}
