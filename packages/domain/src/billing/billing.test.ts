import { describe, expect, it } from "vitest";
import { accessFromEvent, dailyLimits, isPro, planOf } from "./index.js";

const now = new Date("2026-10-14T10:00:00Z");
const ms = (iso: string) => new Date(iso).getTime();
const cfg = { proScans: 10, proCoach: 40 };

describe("isPro / planOf", () => {
  it("is Pro until the access date, or forever with a lifetime purchase", () => {
    expect(isPro(null, now)).toBe(false);
    expect(isPro({ proUntil: new Date("2026-11-14"), lifetime: false }, now)).toBe(true);
    expect(isPro({ proUntil: new Date("2026-10-13"), lifetime: false }, now)).toBe(false);
    expect(isPro({ proUntil: null, lifetime: false }, now)).toBe(false);
    expect(planOf({ proUntil: null, lifetime: true }, now)).toBe("PRO");
  });
});

describe("dailyLimits", () => {
  it("gives Premium every feature with fair-use limits", () => {
    expect(dailyLimits("PRO", cfg)).toEqual({
      scans: 10,
      coach: 40,
      labelScans: true,
      barcode: true,
      reminders: 50,
    });
  });
  it("leaves AI, barcode and extra reminders to Premium on the free plan", () => {
    expect(dailyLimits("FREE", cfg)).toEqual({
      scans: 0,
      coach: 0,
      labelScans: false,
      barcode: false,
      reminders: 3,
    });
  });
});

describe("accessFromEvent", () => {
  const exp = ms("2026-11-14T10:00:00Z");

  it("grants access until expiry on purchases, renewals and extensions", () => {
    for (const type of [
      "INITIAL_PURCHASE",
      "RENEWAL",
      "UNCANCELLATION",
      "PRODUCT_CHANGE",
      "SUBSCRIPTION_EXTENDED",
    ]) {
      expect(
        accessFromEvent({ type, expiration_at_ms: exp, entitlement_ids: ["pro"] }, "pro"),
      ).toEqual({
        proUntil: new Date(exp),
        lifetime: false,
        willRenew: true,
      });
    }
  });

  it("treats a non-expiring one-off purchase as lifetime", () => {
    expect(
      accessFromEvent({ type: "NON_RENEWING_PURCHASE", expiration_at_ms: null }, "pro"),
    ).toEqual({
      proUntil: null,
      lifetime: true,
      willRenew: false,
    });
  });

  it("keeps access to the end of the period on cancellation, and ends it on expiration", () => {
    expect(accessFromEvent({ type: "CANCELLATION", expiration_at_ms: exp }, "pro")).toMatchObject({
      proUntil: new Date(exp),
      willRenew: false,
    });
    const ended = accessFromEvent(
      { type: "EXPIRATION", expiration_at_ms: ms("2026-10-14T09:00:00Z") },
      "pro",
    );
    expect(isPro(ended, now)).toBe(false);
    expect(isPro(accessFromEvent({ type: "EXPIRATION" }, "pro"), now)).toBe(false);
  });

  it("keeps access through the grace period on a billing issue", () => {
    const grace = ms("2026-10-20T00:00:00Z");
    expect(
      accessFromEvent(
        {
          type: "BILLING_ISSUE",
          expiration_at_ms: ms("2026-10-13T00:00:00Z"),
          grace_period_expiration_at_ms: grace,
        },
        "pro",
      )?.proUntil,
    ).toEqual(new Date(grace));
  });

  it("ignores test, transfer and pause events, and other entitlements", () => {
    expect(accessFromEvent({ type: "TEST" }, "pro")).toBeNull();
    expect(accessFromEvent({ type: "TRANSFER" }, "pro")).toBeNull();
    expect(
      accessFromEvent({ type: "SUBSCRIPTION_PAUSED", expiration_at_ms: exp }, "pro"),
    ).toBeNull();
    expect(
      accessFromEvent(
        { type: "INITIAL_PURCHASE", expiration_at_ms: exp, entitlement_ids: ["other"] },
        "pro",
      ),
    ).toBeNull();
  });
});
