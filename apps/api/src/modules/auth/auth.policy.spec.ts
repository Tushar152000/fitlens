import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  clip,
  initialExpiry,
  isAllowedAppRedirect,
  isSessionLive,
  pkceChallenge,
  pkceMatches,
  safeReturnPath,
  slideExpiry,
  truncateIp,
} from "./auth.policy.js";

const ORIGIN = "https://fitlens.app";

describe("safeReturnPath", () => {
  it("keeps same-origin paths with query and hash", () => {
    expect(safeReturnPath("/today", ORIGIN)).toBe("/today");
    expect(safeReturnPath("/log/type?meal=LUNCH#top", ORIGIN)).toBe("/log/type?meal=LUNCH#top");
    expect(safeReturnPath("/a/../b", ORIGIN)).toBe("/b");
  });

  it.each([
    undefined,
    null,
    42,
    "",
    "today",
    "//evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "https://evil.example/x",
    "javascript:alert(1)",
    "/ok\nSet-Cookie: x",
    "/\t/evil.example",
  ])("falls back to /today for %j", (value) => {
    expect(safeReturnPath(value, ORIGIN)).toBe("/today");
  });

  it("never resolves to another host, whatever it's given", () => {
    for (const value of [
      "/a",
      "//evil.example",
      "/\\evil.example",
      "/\\/evil.example",
      "///evil.example",
      "/%2F%2Fevil.example",
      "/\t/evil.example",
      "https:evil.example",
    ]) {
      expect(new URL(safeReturnPath(value, ORIGIN), ORIGIN).host).toBe("fitlens.app");
    }
  });
});

describe("isAllowedAppRedirect", () => {
  it("accepts the app scheme everywhere and Expo Go only outside production", () => {
    expect(isAllowedAppRedirect("fitlens://auth", true)).toBe(true);
    expect(isAllowedAppRedirect("fitlens://auth", false)).toBe(true);
    expect(isAllowedAppRedirect("exp://192.168.1.5:8081/--/auth", false)).toBe(true);
    expect(isAllowedAppRedirect("exps://u.expo.dev/--/auth", false)).toBe(true);
    expect(isAllowedAppRedirect("exp://192.168.1.5:8081/--/auth", true)).toBe(false);
  });

  it.each(["https://evil.example/steal", "http://localhost/x", "javascript:alert(1)", "nope", ""])(
    "rejects %j",
    (value) => {
      expect(isAllowedAppRedirect(value, false)).toBe(false);
    },
  );
});

describe("PKCE", () => {
  it("matches the RFC 7636 appendix B example", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(pkceChallenge(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(pkceMatches(verifier, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")).toBe(true);
    expect(pkceMatches(`${verifier}x`, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")).toBe(false);
  });
});

describe("truncateIp", () => {
  it.each([
    ["203.0.113.77", "203.0.113.0"],
    ["::ffff:203.0.113.77", "203.0.113.0"],
    ["2001:db8:abcd:12:1:2:3:4", "2001:db8:abcd::"],
    ["2001:0DB8:00ab::1", "2001:db8:ab::"],
    ["::1", "0:0:0::"],
    ["not-an-ip", null],
    ["", null],
    [undefined, null],
  ])("%j → %j", (input, expected) => {
    expect(truncateIp(input)).toBe(expected);
  });
});

describe("clip", () => {
  it("cuts long values and maps empty to null", () => {
    expect(clip("abcdef", 3)).toBe("abc");
    expect(clip("", 3)).toBeNull();
    expect(clip(undefined, 3)).toBeNull();
  });
});

describe("session expiry", () => {
  const t0 = new Date("2026-01-01T00:00:00.000Z");
  const at = (days: number) => new Date(t0.getTime() + days * DAY_MS);

  it("starts with the idle window, capped by the hard limit", () => {
    expect(initialExpiry(t0, 30, 365)).toEqual({ expiresAt: at(30), absoluteExpiresAt: at(365) });
    expect(initialExpiry(t0, 30, 10)).toEqual({ expiresAt: at(10), absoluteExpiresAt: at(10) });
  });

  it("is live only before both expiries", () => {
    const s = { lastSeenAt: t0, expiresAt: at(30), absoluteExpiresAt: at(365) };
    expect(isSessionLive(s, at(29))).toBe(true);
    expect(isSessionLive(s, at(30))).toBe(false);
    expect(isSessionLive({ ...s, expiresAt: at(400) }, at(365))).toBe(false);
  });

  it("slides at most once a day and never past the hard limit", () => {
    const s = { lastSeenAt: t0, expiresAt: at(30), absoluteExpiresAt: at(365) };
    expect(slideExpiry(s, new Date(t0.getTime() + DAY_MS - 1), 30)).toBeNull();
    expect(slideExpiry(s, at(1), 30)).toEqual({ lastSeenAt: at(1), expiresAt: at(31) });
    expect(slideExpiry({ ...s, lastSeenAt: at(350) }, at(351), 30)).toEqual({
      lastSeenAt: at(351),
      expiresAt: at(365),
    });
  });
});
