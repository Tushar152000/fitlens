import { describe, expect, it } from "vitest";
import { previewTarget } from "@fitr8/domain/nutrition";
import { emptyDraft, type OnboardingDraft } from "./draft";
import { estimateFromDraft } from "./estimate";

const today = new Date("2026-10-13T00:00:00Z");
const body: OnboardingDraft = {
  ...emptyDraft(today),
  sex: "MALE",
  birthDate: "1997-04-12",
  heightCm: "176",
  weightKg: "82",
  activityLevel: "LIGHT",
  goalType: undefined,
};

describe("estimateFromDraft", () => {
  it("is null until body stats are known", () => {
    expect(estimateFromDraft(emptyDraft(today), { today })).toBeNull();
    expect(estimateFromDraft({ ...body, weightKg: "" }, { today })).toBeNull();
    expect(estimateFromDraft({ ...body, heightCm: "90" }, { today })).toBeNull();
  });

  it("uses the landing-page preview pace until the goal is complete", () => {
    const e = estimateFromDraft({ ...body, goalType: "FAT_LOSS" }, { today });
    const p = previewTarget(
      { sex: "MALE", ageYears: 29, heightCm: 176, weightKg: 82, activityLevel: "LIGHT" },
      "FAT_LOSS",
      today,
    );
    expect(e).toMatchObject({ exact: false, kcal: p.kcal, proteinG: p.proteinG });
  });

  it("uses the real goal once target and date are set", () => {
    const e = estimateFromDraft(
      { ...body, goalType: "FAT_LOSS", targetWeightKg: "74", targetDate: "2027-02-02" },
      { today },
    );
    expect(e?.exact).toBe(true);
    expect(e?.targetWeightKg).toBe(74);
    expect(e?.kcal).toBe(1898); // 2,448 maintenance − 550 for 8 kg in 16 weeks
  });

  it("falls back to the calculator age when there's no date of birth", () => {
    expect(estimateFromDraft({ ...body, birthDate: "" }, { today })).toBeNull();
    expect(
      estimateFromDraft({ ...body, birthDate: "" }, { today, fallbackAgeYears: 29 }),
    ).not.toBeNull();
  });

  it("keeps maintenance with a medical flag", () => {
    const e = estimateFromDraft(
      {
        ...body,
        goalType: "FAT_LOSS",
        targetWeightKg: "74",
        targetDate: "2027-02-02",
        medicalFlag: true,
      },
      { today },
    );
    expect(e?.kcal).toBe(Math.round(1780 * 1.375));
  });
});
