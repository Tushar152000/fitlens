import { z } from "zod";

/**
 * Sign-in and sessions: one contract for every client. The web app carries the session in an
 * httpOnly cookie, the native app as `Authorization: Bearer <token>`; every route below behaves the
 * same for both.
 */

/** A PKCE value (RFC 7636): 43–128 chars of [A-Za-z0-9-._~]. */
const pkce = z.string().regex(/^[A-Za-z0-9\-._~]{43,128}$/, "Invalid PKCE value");

/** GET /api/auth/google?returnTo=/today — web sign-in. `returnTo` must be a same-site path. */
export const GoogleStartQuerySchema = z.object({
  returnTo: z.string().max(512).optional(),
});
export type GoogleStartQuery = z.infer<typeof GoogleStartQuerySchema>;

/** GET /api/auth/mobile/start — app sign-in, opened in the system browser. */
export const MobileStartQuerySchema = z.object({
  /** base64url(SHA-256(verifier)), the S256 method. */
  challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Invalid PKCE challenge"),
  /** Where the browser hands the one-time code back to the app, e.g. `fitlens://auth`. */
  redirect: z.string().min(1).max(512),
});
export type MobileStartQuery = z.infer<typeof MobileStartQuerySchema>;

/** POST /api/auth/mobile/token — trade the one-time code and the PKCE verifier for a session. */
export const MobileTokenSchema = z.object({
  code: z.string().min(1).max(256),
  verifier: pkce,
});
export type MobileTokenInput = z.infer<typeof MobileTokenSchema>;

/**
 * POST /api/auth/apple — native Sign in with Apple (iOS). The app asks Apple with
 * `nonce = SHA-256(nonce)` (hex) and sends the raw value here; Apple returns the hash in the token.
 */
export const AppleSignInSchema = z.object({
  identityToken: z.string().min(1).max(8192),
  /** One-time code; traded for a refresh token so account deletion can revoke the sign-in. */
  authorizationCode: z.string().min(1).max(1024).optional(),
  nonce: z.string().min(16).max(128),
  /** Only sent by Apple on the very first sign-in. */
  fullName: z
    .object({
      givenName: z.string().trim().max(80).nullish(),
      familyName: z.string().trim().max(80).nullish(),
    })
    .nullish(),
});
export type AppleSignInInput = z.infer<typeof AppleSignInSchema>;

/** POST /api/auth/dev — local development and tests only (refused in production). */
export const DevLoginSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().trim().min(1).max(80).optional(),
});
export type DevLoginInput = z.infer<typeof DevLoginSchema>;

export type SessionClient = "WEB" | "MOBILE";

/** GET /api/auth/providers — which sign-in buttons the login screen shows. */
export interface ProvidersDto {
  google: boolean;
  /** Sign in with Apple (the iOS app shows its button only when this is true). */
  apple: boolean;
  dev: boolean;
}

/** A new session for a bearer client (the app). Store `token` in the Keychain / Keystore. */
export interface AuthTokenDto {
  token: string;
  /** Current idle expiry (ISO). It slides forward while the app is used. */
  expiresAt: string;
}

/** POST /api/auth/dev */
export interface DevLoginDto extends AuthTokenDto {
  userId: string;
}

/** One signed-in device in GET /api/auth/sessions. */
export interface SessionDto {
  id: string;
  client: SessionClient;
  userAgent: string | null;
  /** Truncated IP (IPv4 /24, IPv6 /48). */
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  /** The session making this request. */
  current: boolean;
}
