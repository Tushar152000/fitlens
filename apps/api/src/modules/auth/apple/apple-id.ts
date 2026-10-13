import { Inject } from "@nestjs/common";

/**
 * Port for Sign in with Apple (native, iOS). AuthService depends on this interface only, so tests
 * swap in a fake.
 */
export interface AppleSignIn {
  /** False without APPLE_CLIENT_ID: the app hides the button. */
  readonly enabled: boolean;
  /** Team id, key id and private key are set, so codes can be exchanged and tokens revoked. */
  readonly canRevoke: boolean;
  /**
   * Verifies the identity token's signature (Apple's JWKS), issuer, audience (our bundle id) and
   * expiry, and returns its claims. The caller checks the nonce. Throws OidcError.
   */
  verifyIdentityToken(identityToken: string): Promise<AppleIdentity>;
  /** Trades the one-time authorization code for a refresh token (null if Apple sent none). */
  refreshTokenFor(authorizationCode: string): Promise<string | null>;
  /** Revokes a refresh token: the user's "Sign in with Apple" link to FITR8 ends. */
  revoke(refreshToken: string): Promise<void>;
}

export interface AppleIdentity {
  /** Stable user id (`sub`), the same across our team's apps. */
  subject: string;
  /** May be a private relay address (…@privaterelay.appleid.com). */
  email: string | null;
  emailVerified: boolean;
  /** The `nonce` claim: SHA-256 (hex) of the raw nonce the app generated. */
  nonce: string | null;
}

export const APPLE_ID = Symbol("APPLE_ID");
export const InjectAppleId = () => Inject(APPLE_ID);
