import { randomBytes } from "node:crypto";
import type { AppleIdentity, AppleSignIn } from "../../src/modules/auth/apple/apple-id.js";
import { OidcError } from "../../src/modules/auth/google/oidc.js";

/**
 * Stands in for Apple in e2e tests. `issue()` is what the iOS sheet returns: an opaque identity
 * token the fake later "verifies", and a code that maps to a refresh token. Revocations are recorded.
 */
export class FakeApple implements AppleSignIn {
  enabled = true;
  canRevoke = true;
  readonly revoked: string[] = [];
  private readonly tokens = new Map<string, AppleIdentity>();
  private readonly codes = new Map<string, string>();

  issue(identity: Partial<AppleIdentity> & { nonce: string }) {
    const identityToken = `apple-token-${randomBytes(8).toString("hex")}`;
    const authorizationCode = `apple-code-${randomBytes(8).toString("hex")}`;
    this.tokens.set(identityToken, {
      subject: `000${randomBytes(4).toString("hex")}.apple`,
      email: `${randomBytes(6).toString("hex")}@privaterelay.appleid.test`,
      emailVerified: true,
      ...identity,
    });
    this.codes.set(authorizationCode, `refresh-${randomBytes(6).toString("hex")}`);
    return { identityToken, authorizationCode };
  }

  /** The refresh token Apple would hand out for a code (to assert revocation). */
  refreshFor(code: string) {
    return this.codes.get(code);
  }

  async verifyIdentityToken(token: string): Promise<AppleIdentity> {
    const identity = this.tokens.get(token);
    if (!identity) throw new OidcError("id_token_invalid", "unknown token");
    return identity;
  }

  async refreshTokenFor(code: string): Promise<string | null> {
    return this.codes.get(code) ?? null;
  }

  async revoke(refreshToken: string): Promise<void> {
    this.revoked.push(refreshToken);
  }
}
