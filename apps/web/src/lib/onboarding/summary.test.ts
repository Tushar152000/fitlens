import { describe, expect, it } from "vitest";
import { emptyDraft, type OnboardingDraft } from "./draft";
import { bodySummary, trainingSummary } from "./summary";

const today = new Date("2026-11-18T00:00:00Z");
const blank: OnboardingDraft = emptyDraft(today);

describe("bodySummary", () => {
  it("is empty before anything is answered", () => {
    expect(bodySummary(blank, today)).toBe("");
  });

  it("lists what's answered, in order", () => {
    expect(
      bodySummary(
        {
          ...blank,
          sex: "MALE",
          birthDate: "1995-06-15",
          heightCm: " 175 ",
          weightKg: "78",
          activityLevel: "MODERATE",
        },
        today,
      ),
    ).toBe("Male · 31 yrs · 175 cm · 78 kg · Moderately active");
  });

  it("skips gaps and a half-typed date", () => {
    expect(
      bodySummary({ ...blank, sex: "FEMALE", birthDate: "1995-0", weightKg: "60" }, today),
    ).toBe("Female · 60 kg");
  });

  it("counts a birthday later this year", () => {
    expect(bodySummary({ ...blank, birthDate: "1995-12-01" }, today)).toBe("30 yrs");
  });
});

describe("trainingSummary", () => {
  it("always has days and minutes (they have defaults)", () => {
    expect(trainingSummary(blank)).toBe(
      `${blank.trainingDaysPerWeek} days · ${blank.sessionMinutes} min`,
    );
  });

  it("adds diet and where they train", () => {
    expect(
      trainingSummary({
        ...blank,
        dietType: "NON_VEG",
        equipment: "FULL_GYM",
        trainingDaysPerWeek: 4,
        sessionMinutes: 45,
      }),
    ).toBe("Non-veg · Gym · 4 days · 45 min");
  });
});
