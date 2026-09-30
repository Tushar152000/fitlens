import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isAllowedRedirect, isChallenge, redeemCode, signCode } from "./mobile-handoff.js";

const secret = "test-secret-at-least-16";
const verifier = "a".repeat(64);
const challenge = createHash("sha256").update(verifier).digest("base64url");

describe("app sign-in hand-off", () => {
  it("redeems a fresh code with the right verifier", () => {
    const code = signCode(secret, "user_1", challenge);
    expect(redeemCode(secret, code, verifier)).toBe("user_1");
  });

  it("rejects the wrong verifier, a tampered code and an expired code", () => {
    const code = signCode(secret, "user_1", challenge);
    expect(() => redeemCode(secret, code, "b".repeat(64))).toThrow(/Bad sign-in code/);
    const [payload, sig] = code.split(".");
    const forged = Buffer.from(
      JSON.stringify({ u: "user_2", c: challenge, exp: Date.now() + 60_000 }),
    );
    expect(() => redeemCode(secret, `${forged.toString("base64url")}.${sig}`, verifier)).toThrow();
    expect(() => redeemCode(secret, `${payload}.x${sig}`, verifier)).toThrow();
    expect(() => redeemCode(secret, code, verifier, Date.now() + 3 * 60_000)).toThrow(/expired/);
    expect(() => redeemCode("another-secret-value", code, verifier)).toThrow(/Bad sign-in code/);
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
