import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
} from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { GOOGLE_TOKEN_URL, GoogleOidcClient } from "./google-oidc.client.js";

const CLIENT_ID = "client-123.apps.googleusercontent.com";

describe("GoogleOidcClient", () => {
  let privateKey: CryptoKey;
  let otherKey: CryptoKey;
  let jwk: JWK;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
    otherKey = (await generateKeyPair("RS256")).privateKey;
  });

  const client = (fetchImpl?: typeof fetch) =>
    new GoogleOidcClient({
      clientId: CLIENT_ID,
      clientSecret: "secret",
      keys: createLocalJWKSet({ keys: [jwk] }),
      fetch: fetchImpl,
    });

  const idToken = (claims: Record<string, unknown> = {}, opts: { key?: CryptoKey } = {}) =>
    new SignJWT({
      email: "Asha@Example.com",
      email_verified: true,
      name: "Asha",
      picture: "https://lh3.googleusercontent.com/a/x",
      nonce: "n-1",
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer((claims.iss as string) ?? "https://accounts.google.com")
      .setAudience((claims.aud as string) ?? CLIENT_ID)
      .setSubject((claims.sub as string) ?? "google-sub-1")
      .setIssuedAt()
      .setExpirationTime((claims.exp as number) ?? "5m")
      .sign(opts.key ?? privateKey);

  it("is disabled without a client id and secret", () => {
    const off = new GoogleOidcClient({});
    expect(off.enabled).toBe(false);
    expect(() =>
      off.authorizeUrl({ redirectUri: "x", state: "s", nonce: "n", codeChallenge: "c" }),
    ).toThrow(/not configured/);
  });

  it("builds an authorization URL with PKCE S256, nonce and state", () => {
    const url = new URL(
      client().authorizeUrl({
        redirectUri: "https://fitlens.app/api/auth/callback/google",
        state: "st",
        nonce: "nn",
        codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: CLIENT_ID,
      redirect_uri: "https://fitlens.app/api/auth/callback/google",
      response_type: "code",
      scope: "openid email profile",
      state: "st",
      nonce: "nn",
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      code_challenge_method: "S256",
      prompt: "select_account",
    });
  });

  it("verifies a genuine ID token and normalises its claims", async () => {
    await expect(client().verifyIdToken(await idToken())).resolves.toEqual({
      subject: "google-sub-1",
      email: "asha@example.com",
      emailVerified: true,
      name: "Asha",
      picture: "https://lh3.googleusercontent.com/a/x",
      nonce: "n-1",
    });
    const legacyIssuer = await idToken({ iss: "accounts.google.com", email_verified: "true" });
    await expect(client().verifyIdToken(legacyIssuer)).resolves.toMatchObject({
      emailVerified: true,
    });
  });

  it.each([
    ["another audience", { aud: "someone-else" }, {}],
    ["another issuer", { iss: "https://evil.example" }, {}],
    ["an expired token", { exp: Math.floor(Date.now() / 1000) - 120 }, {}],
    ["a forged signature", {}, { forged: true }],
  ])("rejects %s", async (_label, claims, { forged }: { forged?: boolean }) => {
    const token = await idToken(claims, forged ? { key: otherKey } : {});
    await expect(client().verifyIdToken(token)).rejects.toMatchObject({
      name: "OidcError",
      reason: "id_token_invalid",
    });
  });

  it("rejects junk and alg=none tokens", async () => {
    await expect(client().verifyIdToken("not.a.jwt")).rejects.toMatchObject({
      reason: "id_token_invalid",
    });
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${b64({ alg: "none" })}.${b64({ sub: "x", aud: CLIENT_ID, iss: "https://accounts.google.com", exp: 9e9, iat: 1 })}.`;
    await expect(client().verifyIdToken(none)).rejects.toMatchObject({
      reason: "id_token_invalid",
    });
  });

  it("redeems the code with the PKCE verifier and verifies the returned token", async () => {
    const token = await idToken();
    const fetchMock = vi.fn(async () => Response.json({ id_token: token }));
    const identity = await client(fetchMock as unknown as typeof fetch).exchange({
      code: "auth-code",
      codeVerifier: "v".repeat(43),
      redirectUri: "https://fitlens.app/api/auth/callback/google",
    });
    expect(identity.subject).toBe("google-sub-1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GOOGLE_TOKEN_URL);
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      grant_type: "authorization_code",
      code: "auth-code",
      code_verifier: "v".repeat(43),
      redirect_uri: "https://fitlens.app/api/auth/callback/google",
      client_id: CLIENT_ID,
      client_secret: "secret",
    });
  });

  it("fails cleanly when Google refuses, is unreachable or sends no ID token", async () => {
    const params = { code: "c", codeVerifier: "v".repeat(43), redirectUri: "r" };
    const refused = vi.fn(async () => new Response("{}", { status: 400 }));
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const empty = vi.fn(async () => Response.json({ access_token: "x" }));
    for (const f of [refused, down, empty]) {
      await expect(client(f as unknown as typeof fetch).exchange(params)).rejects.toMatchObject({
        reason: "token_exchange_failed",
      });
    }
  });
});
