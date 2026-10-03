import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AuthorizeParams, ExchangeParams, OidcIdentity, OidcProvider } from "./oidc.js";
import { OidcError } from "./oidc.js";

export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
/** Google issues ID tokens with either form (https://developers.google.com/identity/openid-connect/openid-connect#validatinganidtoken). */
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GoogleOidcConfig {
  clientId?: string;
  clientSecret?: string;
  /** Overridable for tests; defaults to Google's published keys (cached and rotated by jose). */
  keys?: JWTVerifyGetKey;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Google sign-in: OpenID Connect authorization-code flow with PKCE and a nonce.
 *
 * Google already authenticates the token request with our client secret and returns the ID token
 * over TLS, which OIDC Core §3.1.3.7 accepts. We still verify the signature, issuer, audience and
 * expiry, so a misrouted or replayed token is rejected here and never reaches user lookup.
 */
export class GoogleOidcClient implements OidcProvider {
  private readonly keys: JWTVerifyGetKey;
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: GoogleOidcConfig) {
    this.keys = config.keys ?? createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
    this.fetch = config.fetch ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  get enabled(): boolean {
    return Boolean(this.config.clientId && this.config.clientSecret);
  }

  authorizeUrl({ redirectUri, state, nonce, codeChallenge }: AuthorizeParams): string {
    const clientId = this.requireClientId();
    const url = new URL(GOOGLE_AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return url.href;
  }

  async exchange({ code, codeVerifier, redirectUri }: ExchangeParams): Promise<OidcIdentity> {
    const clientId = this.requireClientId();
    let res: Response;
    try {
      res = await this.fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: this.config.clientSecret!,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new OidcError("token_exchange_failed", "Couldn't reach Google");
    }
    if (!res.ok)
      throw new OidcError("token_exchange_failed", `Google token endpoint: ${res.status}`);
    const body = (await res.json().catch(() => null)) as { id_token?: unknown } | null;
    if (typeof body?.id_token !== "string") {
      throw new OidcError("token_exchange_failed", "Google returned no ID token");
    }
    return this.verifyIdToken(body.id_token);
  }

  /** Signature (RS256, Google's JWKS), issuer, audience = our client id, expiry (60 s clock skew). */
  async verifyIdToken(idToken: string): Promise<OidcIdentity> {
    let claims: Record<string, unknown>;
    try {
      ({ payload: claims } = await jwtVerify(idToken, this.keys, {
        issuer: GOOGLE_ISSUERS,
        audience: this.requireClientId(),
        algorithms: ["RS256"],
        clockTolerance: 60,
        requiredClaims: ["sub", "exp", "iat"],
      }));
    } catch (err) {
      throw new OidcError(
        "id_token_invalid",
        `Google ID token rejected: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const str = (v: unknown) => (typeof v === "string" && v ? v : null);
    const subject = str(claims.sub);
    if (!subject) throw new OidcError("id_token_invalid", "Google ID token has no subject");
    return {
      subject,
      email: str(claims.email)?.toLowerCase() ?? null,
      // Google sends a boolean; tolerate the string form some older tokens used.
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      name: str(claims.name),
      picture: str(claims.picture),
      nonce: str(claims.nonce),
    };
  }

  private requireClientId(): string {
    if (!this.enabled) throw new OidcError("not_configured", "Google sign-in is not configured");
    return this.config.clientId!;
  }
}
