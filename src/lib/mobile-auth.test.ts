import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
const { isAllowedRedirect, isChallenge, redeemCode, signCode } = await import("./mobile-auth");

const verifier = "a".repeat(64);
const challenge = createHash("sha256").update(verifier).digest("base64url");

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret";
});

describe("app sign-in hand-off", () => {
  it("redeems a fresh code with the right verifier", () => {
    const code = signCode("user_1", challenge);
    expect(redeemCode(code, verifier)).toBe("user_1");
  });

  it("rejects the wrong verifier, a tampered code and an expired code", () => {
    const code = signCode("user_1", challenge);
    expect(() => redeemCode(code, "b".repeat(64))).toThrow(/Bad sign-in code/);
    const [payload, sig] = code.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "user_2", c: challenge, e: Date.now() + 60_000 }));
    expect(() => redeemCode(`${forged.toString("base64url")}.${sig}`, verifier)).toThrow();
    expect(() => redeemCode(`${payload}.x${sig}`, verifier)).toThrow();
    expect(() => redeemCode(code, verifier, Date.now() + 3 * 60_000)).toThrow(/expired/);
  });

  it("only hands codes to the app or Expo Go", () => {
    expect(isAllowedRedirect("fitlens://auth")).toBe(true);
    expect(isAllowedRedirect("exp://192.168.1.5:8081/--/auth")).toBe(true);
    expect(isAllowedRedirect("https://evil.example/steal")).toBe(false);
    expect(isAllowedRedirect("javascript:alert(1)")).toBe(false);
    expect(isChallenge(challenge)).toBe(true);
    expect(isChallenge("short")).toBe(false);
  });
});
