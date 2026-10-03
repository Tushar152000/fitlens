import { createHash, randomBytes } from "node:crypto";
import type {
  AuthorizeParams,
  ExchangeParams,
  OidcIdentity,
  OidcProvider,
} from "../../src/modules/auth/google/oidc.js";
import { OidcError } from "../../src/modules/auth/google/oidc.js";

interface Grant {
  identity: OidcIdentity;
  challenge: string;
}

/**
 * Stands in for Google in e2e tests. Behaves like the real token endpoint where it matters: codes
 * work once, and only with the PKCE verifier matching the challenge from the authorize URL.
 */
export class FakeGoogle implements OidcProvider {
  enabled = true;
  private readonly grants = new Map<string, Grant>();

  authorizeUrl(p: AuthorizeParams): string {
    const url = new URL("https://accounts.google.test/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      redirect_uri: p.redirectUri,
      state: p.state,
      nonce: p.nonce,
      code_challenge: p.codeChallenge,
      code_challenge_method: "S256",
    }).toString();
    return url.href;
  }

  /** What Google does when the user picks an account: a code for this identity. */
  issueCode(identity: Partial<OidcIdentity> & { nonce: string | null }, challenge: string): string {
    const code = randomBytes(12).toString("hex");
    this.grants.set(code, {
      challenge,
      identity: {
        subject: `google-${randomBytes(6).toString("hex")}`,
        email: `${randomBytes(6).toString("hex")}@gmail.test`,
        emailVerified: true,
        name: "Test Person",
        picture: "https://lh3.googleusercontent.test/a/photo",
        ...identity,
      },
    });
    return code;
  }

  async exchange({ code, codeVerifier }: ExchangeParams): Promise<OidcIdentity> {
    const grant = this.grants.get(code);
    this.grants.delete(code);
    const challenge = createHash("sha256").update(codeVerifier).digest("base64url");
    if (!grant || grant.challenge !== challenge) {
      throw new OidcError("token_exchange_failed", "invalid_grant");
    }
    return grant.identity;
  }
}
