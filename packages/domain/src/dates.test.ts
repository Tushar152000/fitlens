import { describe, expect, it } from "vitest";
import {
  localDate,
  MEAL_BACKFILL_DAYS,
  mealDateProblem,
  parseDateOnly,
  startOfLocalDay,
} from "./dates.js";

describe("dates", () => {
  it("finds local midnight for India (UTC+5:30)", () => {
    const at = new Date("2026-09-24T07:30:00Z"); // 13:00 IST
    expect(startOfLocalDay("Asia/Kolkata", at).toISOString()).toBe("2026-09-23T18:30:00.000Z");
  });

  it("uses the local day, not the UTC day", () => {
    const at = new Date("2026-09-23T20:00:00Z"); // 01:30 IST on the 24th
    expect(localDate("Asia/Kolkata", at).toISOString().slice(0, 10)).toBe("2026-09-24");
    expect(startOfLocalDay("Asia/Kolkata", at).toISOString()).toBe("2026-09-23T18:30:00.000Z");
  });

  it("handles zones behind UTC", () => {
    const at = new Date("2026-01-15T03:00:00Z"); // 22:00 on the 14th in New York (EST)
    expect(startOfLocalDay("America/New_York", at).toISOString()).toBe("2026-01-14T05:00:00.000Z");
  });
});

describe("mealDateProblem", () => {
  const today = parseDateOnly("2026-11-16");
  it("allows today and up to MEAL_BACKFILL_DAYS back", () => {
    expect(mealDateProblem(today, today)).toBeNull();
    expect(mealDateProblem(parseDateOnly("2026-11-15"), today)).toBeNull();
    expect(mealDateProblem(parseDateOnly("2026-11-09"), today)).toBeNull();
    expect(MEAL_BACKFILL_DAYS).toBe(7);
  });
  it("rejects future days, older days and invalid dates", () => {
    expect(mealDateProblem(parseDateOnly("2026-11-17"), today)).toMatch(/future/);
    expect(mealDateProblem(parseDateOnly("2026-11-08"), today)).toMatch(/7 days back/);
    expect(mealDateProblem(parseDateOnly("2026-13-40"), today)).toMatch(/real date/);
  });
});
