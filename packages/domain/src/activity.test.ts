import { describe, expect, it } from "vitest";
import {
  ACTIVITY_TOUCH_MS,
  WELCOME_BACK_AFTER_DAYS,
  isWelcomeBack,
  shouldTouchActivity,
} from "./activity.js";

const now = new Date("2026-11-17T10:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe("isWelcomeBack", () => {
  it("never for a user who hasn't onboarded", () => {
    expect(isWelcomeBack({ onboardedAt: null, lastActiveAt: daysAgo(400) }, now)).toBe(false);
  });

  it("false while the user is active", () => {
    expect(isWelcomeBack({ onboardedAt: daysAgo(400), lastActiveAt: daysAgo(3) }, now)).toBe(false);
  });

  it("true at exactly the threshold and beyond", () => {
    const at = { onboardedAt: daysAgo(400), lastActiveAt: daysAgo(WELCOME_BACK_AFTER_DAYS) };
    expect(isWelcomeBack(at, now)).toBe(true);
    expect(isWelcomeBack({ ...at, lastActiveAt: daysAgo(200) }, now)).toBe(true);
  });

  it("false one day short of the threshold", () => {
    const s = { onboardedAt: daysAgo(400), lastActiveAt: daysAgo(WELCOME_BACK_AFTER_DAYS - 1) };
    expect(isWelcomeBack(s, now)).toBe(false);
  });

  it("falls back to the onboarding date when activity was never recorded", () => {
    expect(isWelcomeBack({ onboardedAt: daysAgo(120), lastActiveAt: null }, now)).toBe(true);
    expect(isWelcomeBack({ onboardedAt: daysAgo(10), lastActiveAt: null }, now)).toBe(false);
  });
});

describe("shouldTouchActivity", () => {
  it("not before onboarding", () => {
    expect(shouldTouchActivity({ onboardedAt: null, lastActiveAt: null }, now)).toBe(false);
  });

  it("not while a welcome back is pending", () => {
    expect(
      shouldTouchActivity({ onboardedAt: daysAgo(400), lastActiveAt: daysAgo(100) }, now),
    ).toBe(false);
  });

  it("throttled to once per interval", () => {
    const recent = new Date(now.getTime() - ACTIVITY_TOUCH_MS + 1000);
    const stale = new Date(now.getTime() - ACTIVITY_TOUCH_MS);
    expect(shouldTouchActivity({ onboardedAt: daysAgo(5), lastActiveAt: recent }, now)).toBe(false);
    expect(shouldTouchActivity({ onboardedAt: daysAgo(5), lastActiveAt: stale }, now)).toBe(true);
    expect(shouldTouchActivity({ onboardedAt: daysAgo(5), lastActiveAt: null }, now)).toBe(true);
  });
});
