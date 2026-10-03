import { Inject } from "@nestjs/common";

/**
 * Port for an OpenID Connect provider (Google today). AuthService depends on this interface only,
 * so tests swap in a fake and another provider is a new implementation, not an edit.
 */
export interface OidcProvider {
  /** False when the client id/secret aren't configured: the login screen hides the button. */
  readonly enabled: boolean;
  /** The provider's consent URL for an authorization-code flow with PKCE (S256) and a nonce. */
  authorizeUrl(params: AuthorizeParams): string;
  /**
   * Redeem the code at the token endpoint and return the ID token's claims, after verifying its
   * signature, issuer, audience and expiry. The caller checks `nonce` and `emailVerified`.
   * Throws OidcError when the provider refuses or the token doesn't verify.
   */
  exchange(params: ExchangeParams): Promise<OidcIdentity>;
}

export interface AuthorizeParams {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

export interface ExchangeParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface OidcIdentity {
  /** Stable, never-reassigned user id at the provider (`sub`). */
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  /** Echo of the nonce we sent; must equal ours (replay protection). */
  nonce: string | null;
}

/** Provider-side failure. `reason` is machine-readable and goes to the audit log. */
export class OidcError extends Error {
  constructor(
    public readonly reason: "token_exchange_failed" | "id_token_invalid" | "not_configured",
    message: string,
  ) {
    super(message);
    this.name = "OidcError";
  }
}

export const GOOGLE_OIDC = Symbol("GOOGLE_OIDC");
export const InjectGoogleOidc = () => Inject(GOOGLE_OIDC);
