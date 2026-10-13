import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTVerifyGetKey } from "jose";
import { OidcError } from "../google/oidc.js";
import type { AppleIdentity, AppleSignIn } from "./apple-id.js";

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
export const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

export interface AppleIdConfig {
  /** The iOS bundle id: the identity token's audience and our client id at Apple. */
  clientId?: string;
  teamId?: string;
  keyId?: string;
  /** PKCS#8 PEM of the .p8 key. `\n` escapes (one-line env values) are accepted. */
  privateKey?: string;
  /** Overridable for tests; defaults to Apple's published keys (cached and rotated by jose). */
  keys?: JWTVerifyGetKey;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Sign in with Apple for the native app (developer.apple.com/documentation/sign_in_with_apple).
 * The app gets an identity token from the system sheet; we verify it here. With a key configured we
 * also redeem the authorization code for a refresh token, which account deletion revokes.
 */
export class AppleIdClient implements AppleSignIn {
  private readonly keys: JWTVerifyGetKey;
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: AppleIdConfig) {
    this.keys = config.keys ?? createRemoteJWKSet(new URL(APPLE_JWKS_URL));
    this.fetch = config.fetch ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  get enabled(): boolean {
    return Boolean(this.config.clientId);
  }

  get canRevoke(): boolean {
    return Boolean(
      this.enabled && this.config.teamId && this.config.keyId && this.config.privateKey,
    );
  }

  async verifyIdentityToken(identityToken: string): Promise<AppleIdentity> {
    let claims: Record<string, unknown>;
    try {
      ({ payload: claims } = await jwtVerify(identityToken, this.keys, {
        issuer: APPLE_ISSUER,
        audience: this.requireClientId(),
        algorithms: ["RS256"],
        clockTolerance: 60,
        requiredClaims: ["sub", "exp", "iat"],
      }));
    } catch (err) {
      if (err instanceof OidcError) throw err;
      throw new OidcError(
        "id_token_invalid",
        `Apple identity token rejected: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const str = (v: unknown) => (typeof v === "string" && v ? v : null);
    const subject = str(claims.sub);
    if (!subject) throw new OidcError("id_token_invalid", "Apple identity token has no subject");
    return {
      subject,
      email: str(claims.email)?.toLowerCase() ?? null,
      // Apple sends "true" (string) or true.
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      nonce: str(claims.nonce),
    };
  }

  async refreshTokenFor(authorizationCode: string): Promise<string | null> {
    const body = await this.post(APPLE_TOKEN_URL, {
      grant_type: "authorization_code",
      code: authorizationCode,
    });
    const json = (await body.json().catch(() => null)) as { refresh_token?: unknown } | null;
    return typeof json?.refresh_token === "string" ? json.refresh_token : null;
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.post(APPLE_REVOKE_URL, { token: refreshToken, token_type_hint: "refresh_token" });
  }

  /**
   * The client secret Apple wants on its token endpoints: an ES256 JWT signed with our key,
   * iss = team id, sub = client id, valid for 5 minutes (Apple allows up to 6 months).
   */
  async clientSecret(now = Math.floor(Date.now() / 1000)): Promise<string> {
    if (!this.canRevoke) throw new OidcError("not_configured", "Apple key is not configured");
    const key = await importPKCS8(this.config.privateKey!.replace(/\\n/g, "\n"), "ES256");
    return new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: this.config.keyId! })
      .setIssuer(this.config.teamId!)
      .setSubject(this.config.clientId!)
      .setAudience(APPLE_ISSUER)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(key);
  }

  private async post(url: string, params: Record<string, string>): Promise<Response> {
    const form = new URLSearchParams({
      client_id: this.requireClientId(),
      client_secret: await this.clientSecret(),
      ...params,
    });
    let res: Response;
    try {
      res = await this.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new OidcError("token_exchange_failed", "Couldn't reach Apple");
    }
    if (!res.ok) throw new OidcError("token_exchange_failed", `Apple ${url}: ${res.status}`);
    return res;
  }

  private requireClientId(): string {
    if (!this.enabled)
      throw new OidcError("not_configured", "Sign in with Apple is not configured");
    return this.config.clientId!;
  }
}
