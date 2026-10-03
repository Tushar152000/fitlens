import { describe, expect, it } from "vitest";
import { randomToken, safeEqual, seal, sha256Hex, unseal } from "./crypto.js";

const secret = "test-secret-please-change-0123456789";

describe("crypto", () => {
  it("makes 256-bit url-safe tokens that don't repeat", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });

  it("hashes to 64 hex chars, deterministically", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("compares strings in constant time", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  describe("seal / unseal", () => {
    const now = 1_700_000_000_000;

    it("round-trips a payload and hides its contents", () => {
      const sealed = seal(secret, "state", { hello: "world" }, 60_000, now);
      expect(sealed).not.toContain("world");
      expect(Buffer.from(sealed, "base64url").toString()).not.toContain("world");
      expect(unseal(secret, "state", sealed, now + 1000)).toEqual({
        ok: true,
        payload: { hello: "world" },
      });
    });

    it("rejects expiry, tampering, another purpose, another secret and junk", () => {
      const sealed = seal(secret, "state", { a: 1 }, 60_000, now);
      expect(unseal(secret, "state", sealed, now + 60_001)).toEqual({
        ok: false,
        reason: "expired",
      });
      const raw = Buffer.from(sealed, "base64url");
      raw[raw.length - 1] ^= 1;
      expect(unseal(secret, "state", raw.toString("base64url"), now)).toEqual({
        ok: false,
        reason: "invalid",
      });
      expect(unseal(secret, "other", sealed, now).ok).toBe(false);
      expect(unseal("another-secret-value-0123456789", "state", sealed, now).ok).toBe(false);
      expect(unseal(secret, "state", "", now).ok).toBe(false);
      expect(unseal(secret, "state", "not-base64-!!", now).ok).toBe(false);
    });
  });
});
