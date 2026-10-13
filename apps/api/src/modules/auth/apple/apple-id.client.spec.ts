import {
  createLocalJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
} from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { OidcError } from "../google/oidc.js";
import { APPLE_REVOKE_URL, APPLE_TOKEN_URL, AppleIdClient } from "./apple-id.client.js";

const CLIENT_ID = "com.fitr8.app";

describe("AppleIdClient", () => {
  let signingKey: CryptoKey;
  let otherKey: CryptoKey;
  let jwk: JWK;
  let p8: string;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    signingKey = pair.privateKey;
    jwk = { ...(await exportJWK(pair.publicKey)), kid: "a1", alg: "RS256" };
    otherKey = (await generateKeyPair("RS256")).privateKey;
    p8 = await exportPKCS8((await generateKeyPair("ES256", { extractable: true })).privateKey);
  });

  const client = (opts: { fetch?: typeof fetch; withKey?: boolean } = {}) =>
    new AppleIdClient({
      clientId: CLIENT_ID,
      ...(opts.withKey !== false && { teamId: "TEAM123", keyId: "KEY123", privateKey: p8 }),
      keys: createLocalJWKSet({ keys: [jwk] }),
      fetch: opts.fetch,
    });

  const token = (claims: Record<string, unknown> = {}, key?: CryptoKey) =>
    new SignJWT({
      email: "Asha@PrivateRelay.AppleID.com",
      email_verified: "true",
      nonce: "h-1",
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: "a1" })
      .setIssuer((claims.iss as string) ?? "https://appleid.apple.com")
      .setAudience((claims.aud as string) ?? CLIENT_ID)
      .setSubject("001234.abcdef.1234")
      .setIssuedAt()
      .setExpirationTime((claims.exp as number) ?? "10m")
      .sign(key ?? signingKey);

  it("is enabled by a client id, and can revoke only with a key", () => {
    expect(client().enabled).toBe(true);
    expect(client().canRevoke).toBe(true);
    expect(client({ withKey: false }).canRevoke).toBe(false);
    expect(new AppleIdClient({}).enabled).toBe(false);
  });

  it("returns the claims of a valid identity token", async () => {
    await expect(client().verifyIdentityToken(await token())).resolves.toEqual({
      subject: "001234.abcdef.1234",
      email: "asha@privaterelay.appleid.com",
      emailVerified: true,
      nonce: "h-1",
    });
    const unverified = await client().verifyIdentityToken(await token({ email_verified: false }));
    expect(unverified.emailVerified).toBe(false);
  });

  it("rejects a wrong signature, audience, issuer or an expired token", async () => {
    const bad = [
      await token({}, otherKey),
      await token({ aud: "com.someone.else" }),
      await token({ iss: "https://accounts.google.com" }),
      await token({ exp: Math.floor(Date.now() / 1000) - 3600 }),
      "not-a-jwt",
    ];
    for (const t of bad) {
      await expect(client().verifyIdentityToken(t)).rejects.toBeInstanceOf(OidcError);
    }
  });

  it("signs a short-lived ES256 client secret for Apple's token endpoints", async () => {
    const secret = await client().clientSecret(1_800_000_000);
    expect(decodeProtectedHeader(secret)).toEqual({ alg: "ES256", kid: "KEY123" });
    expect(decodeJwt(secret)).toEqual({
      iss: "TEAM123",
      sub: CLIENT_ID,
      aud: "https://appleid.apple.com",
      iat: 1_800_000_000,
      exp: 1_800_000_300,
    });
    await expect(client({ withKey: false }).clientSecret()).rejects.toBeInstanceOf(OidcError);
  });

  it("trades the authorization code for a refresh token, and revokes it", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url) === APPLE_TOKEN_URL
        ? Response.json({ refresh_token: "r-1", id_token: "x" })
        : new Response(null, { status: 200 }),
    );
    const c = client({ fetch: fetchMock as unknown as typeof fetch });
    await expect(c.refreshTokenFor("code-1")).resolves.toBe("r-1");
    await c.revoke("r-1");

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const tokenBody = new URLSearchParams(tokenInit.body as URLSearchParams);
    expect(tokenUrl).toBe(APPLE_TOKEN_URL);
    expect(tokenBody.get("grant_type")).toBe("authorization_code");
    expect(tokenBody.get("code")).toBe("code-1");
    expect(tokenBody.get("client_id")).toBe(CLIENT_ID);
    expect(tokenBody.get("client_secret")).toMatch(/^ey/);

    const [revokeUrl, revokeInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    const revokeBody = new URLSearchParams(revokeInit.body as URLSearchParams);
    expect(revokeUrl).toBe(APPLE_REVOKE_URL);
    expect(revokeBody.get("token")).toBe("r-1");
    expect(revokeBody.get("token_type_hint")).toBe("refresh_token");
  });

  it("reports Apple refusing or being unreachable", async () => {
    const refusing = client({
      fetch: (async () => new Response("{}", { status: 400 })) as unknown as typeof fetch,
    });
    await expect(refusing.refreshTokenFor("c")).rejects.toBeInstanceOf(OidcError);
    const down = client({
      fetch: (async () => {
        throw new Error("ECONNRESET");
      }) as unknown as typeof fetch,
    });
    await expect(down.revoke("r")).rejects.toBeInstanceOf(OidcError);
  });
});
