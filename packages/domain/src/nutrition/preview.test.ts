import { describe, expect, it } from "vitest";
import { previewTarget } from "./index.js";

const today = new Date("2026-10-13");
const base = {
  sex: "MALE" as const,
  ageYears: 29,
  heightCm: 176,
  weightKg: 82,
  activityLevel: "LIGHT" as const,
};

describe("previewTarget", () => {
  it("caps a fat-loss preview at 25% under maintenance", () => {
    const p = previewTarget(base, "FAT_LOSS", today);
    expect(p.bmr).toBeCloseTo(1780, 0);
    expect(p.tdee).toBeCloseTo(2447.5, 1);
    expect(p.dailyAdjustmentKcal).toBeCloseTo(-611.9, 1);
    expect(p).toMatchObject({ kcal: 1836, proteinG: 148, fatG: 51, carbsG: 197, waterMl: 3000 });
    expect(p.weeklyChangeKg).toBeCloseTo(-0.56, 2);
    expect(p.noAdjustment).toBe(false);
    expect(p.raisedToFloor).toBe(false);
  });

  it("gives a muscle-gain surplus inside the 5–15% band", () => {
    const p = previewTarget(base, "MUSCLE_GAIN", today);
    expect(p.dailyAdjustmentKcal).toBeGreaterThanOrEqual(p.tdee * 0.05);
    expect(p.dailyAdjustmentKcal).toBeLessThanOrEqual(p.tdee * 0.15);
    expect(p.weeklyChangeKg).toBeCloseTo(0.205, 2);
    expect(p.proteinG).toBe(131); // 1.6 g/kg outside a deficit
  });

  it("uses a light 5% deficit for recomposition", () => {
    const p = previewTarget(base, "RECOMPOSITION", today);
    expect(p.dailyAdjustmentKcal).toBeCloseTo(-p.tdee * 0.05, 1);
  });

  it("never sets a deficit for under-18s", () => {
    const p = previewTarget({ ...base, ageYears: 16 }, "FAT_LOSS", today);
    expect(p.noAdjustment).toBe(true);
    expect(p.dailyAdjustmentKcal).toBe(0);
    expect(p.kcal).toBe(Math.round(p.tdee));
  });

  it("lifts very low targets to the safe minimum", () => {
    const p = previewTarget(
      { sex: "FEMALE", ageYears: 40, heightCm: 150, weightKg: 45, activityLevel: "SEDENTARY" },
      "FAT_LOSS",
      today,
    );
    expect(p.kcal).toBe(1200);
    expect(p.raisedToFloor).toBe(true);
    expect(p.waterMl).toBe(1500);
  });
});
