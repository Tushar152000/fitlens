import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppleIdentity } from "../src/modules/auth/apple/apple-id.js";
import { createTestApp, type TestApp } from "./support/app.js";

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

const rawNonce = () => randomBytes(24).toString("hex");
const hashed = (n: string) => createHash("sha256").update(n).digest("hex");
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** What the iOS app does: Apple sheet (with the hashed nonce) → POST /api/auth/apple. */
async function signInWithApple(
  identity: Partial<Omit<AppleIdentity, "nonce">> = {},
  fullName?: { givenName?: string; familyName?: string },
) {
  const nonce = rawNonce();
  const issued = t.apple.issue({ ...identity, nonce: hashed(nonce) });
  const res = await t
    .http()
    .post("/api/auth/apple")
    .send({ ...issued, nonce, fullName });
  return { res, issued };
}

describe("Sign in with Apple", () => {
  it("rejects a malformed request", async () => {
    await t.http().post("/api/auth/apple").send({}).expect(400);
    await t.http().post("/api/auth/apple").send({ identityToken: "x", nonce: "short" }).expect(400);
  });

  it("signs a new user in, takes their name from the first sign-in, and returns a bearer session", async () => {
    const { res } = await signInWithApple({}, { givenName: "Asha", familyName: "Rao" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: expect.any(String), expiresAt: expect.any(String) });
    const me = await t.http().get("/api/me").set(bearer(res.body.token)).expect(200);
    expect(me.body.name).toBe("Asha Rao");
  });

  it("signs a returning Apple user into the same account", async () => {
    const subject = `000${randomBytes(4).toString("hex")}.apple`;
    const first = await signInWithApple({ subject });
    const again = await signInWithApple({ subject, email: null });
    const a = await t.http().get("/api/me").set(bearer(first.res.body.token)).expect(200);
    const b = await t.http().get("/api/me").set(bearer(again.res.body.token)).expect(200);
    expect(b.body.id).toBe(a.body.id);
  });

  it("links Apple to an existing account with the same verified email", async () => {
    const email = `${randomBytes(6).toString("hex")}@example.test`;
    const existing = await t.http().post("/api/auth/dev").send({ email }).expect(200);
    const { res } = await signInWithApple({ email });
    const me = await t.http().get("/api/me").set(bearer(res.body.token)).expect(200);
    expect(me.body.id).toBe(existing.body.userId);
  });

  it("refuses a token for another sign-in (nonce), an unknown token and an unverified email", async () => {
    const issued = t.apple.issue({ nonce: hashed(rawNonce()) });
    await t
      .http()
      .post("/api/auth/apple")
      .send({ ...issued, nonce: rawNonce() })
      .expect(401);
    await t
      .http()
      .post("/api/auth/apple")
      .send({ identityToken: "forged", nonce: rawNonce() })
      .expect(401);
    const { res } = await signInWithApple({ emailVerified: false });
    expect(res.status).toBe(401);
  });

  it("revokes the Apple sign-in when the account is deleted", async () => {
    const { res, issued } = await signInWithApple();
    await t.http().delete("/api/account").set(bearer(res.body.token)).expect(204);
    expect(t.apple.revoked).toContain(t.apple.refreshFor(issued.authorizationCode));
    await t.http().get("/api/me").set(bearer(res.body.token)).expect(401);
  });
});
