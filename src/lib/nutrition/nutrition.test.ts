import { describe, expect, it } from "vitest";
import { bmi, bmr, bodyFatNavy, macrosFor, planGoal, scaleNutrition, tdee } from ".";

const rahul = {
  sex: "MALE" as const,
  ageYears: 27,
  heightCm: 178,
  weightKg: 82,
  activityLevel: "MODERATE" as const,
  bodyFatPct: 24,
};
const start = new Date("2026-09-28");
const weeksLater = (w: number) => new Date(start.getTime() + w * 7 * 86400000);

describe("body formulas", () => {
  it("computes BMI", () => {
    expect(bmi(82, 178)).toBeCloseTo(25.88, 2);
  });

  it("computes Mifflin-St Jeor BMR and TDEE", () => {
    const b = bmr("MALE", 82, 178, 27);
    expect(b).toBeCloseTo(1802.5, 1);
    expect(tdee(b, "MODERATE")).toBeCloseTo(2793.9, 1);
    expect(bmr("FEMALE", 60, 162, 30)).toBeCloseTo(1301.5, 1);
  });

  it("estimates body fat with the Navy method", () => {
    const bf = bodyFatNavy({ sex: "MALE", heightCm: 178, waistCm: 92, neckCm: 38 });
    expect(bf).not.toBeNull();
    expect(bf!).toBeGreaterThan(18);
    expect(bf!).toBeLessThan(24);
    expect(bodyFatNavy({ sex: "MALE", heightCm: 178, waistCm: 30, neckCm: 38 })).toBeNull();
    expect(bodyFatNavy({ sex: "FEMALE", heightCm: 162, waistCm: 75, neckCm: 32 })).toBeNull();
  });
});

describe("planGoal", () => {
  it("matches the PRD worked example (24% → 16% in 16 weeks)", () => {
    const plan = planGoal(rahul, {
      type: "FAT_LOSS",
      targetBodyFatPct: 16,
      startDate: start,
      targetDate: weeksLater(16),
    });
    expect(plan.targetWeightKg).toBeCloseTo(74.19, 1);
    expect(plan.weeklyChangeKg).toBeCloseTo(-0.488, 2);
    expect(plan.feasible).toBe(true);
    expect(plan.kcal).toBeGreaterThan(2240);
    expect(plan.kcal).toBeLessThan(2275);
    expect(plan.proteinG).toBe(148);
    expect(plan.warnings).toEqual([]);
  });

  it("caps unrealistic fat loss and suggests a later date", () => {
    const plan = planGoal(rahul, {
      type: "FAT_LOSS",
      targetWeightKg: 70,
      startDate: start,
      targetDate: weeksLater(6),
    });
    expect(plan.feasible).toBe(false);
    // Never faster than 1 %/week; here the 25 % deficit cap binds first, so the pace is lower.
    expect(plan.weeklyRatePct).toBeLessThanOrEqual(1.0 + 1e-9);
    expect(plan.suggestedTargetDate!.getTime()).toBeGreaterThan(weeksLater(6).getTime());
    expect(plan.dailyAdjustmentKcal).toBeGreaterThanOrEqual(-plan.tdee * 0.25 - 1e-6);
  });

  it("suggests the date and closer target from the pace after the 25% deficit cap (design 5b)", () => {
    const person = { ...rahul, weightKg: 82, bodyFatPct: undefined };
    const plan = planGoal(person, {
      type: "FAT_LOSS",
      targetWeightKg: 72,
      startDate: start,
      targetDate: weeksLater(8),
    });
    expect(plan.feasible).toBe(false);
    expect(plan.neededWeeklyChangeKg).toBeCloseTo(-1.25, 2);
    // Real pace = capped deficit, not the 1 %/week rate (0.82 kg).
    const pace = (plan.dailyAdjustmentKcal * 7) / 7700;
    expect(plan.weeklyChangeKg).toBeCloseTo(pace, 5);
    expect(Math.abs(plan.weeklyChangeKg)).toBeLessThan(0.82);
    const weeksNeeded = Math.ceil(10 / Math.abs(pace));
    expect(plan.suggestedTargetDate!.getTime()).toBe(weeksLater(weeksNeeded).getTime());
    expect(plan.closerTargetWeightKg!).toBeCloseTo(82 + pace * 8, 5);
    expect(plan.closerTargetWeightKg!).toBeGreaterThan(72);
  });

  it("never goes below the calorie floor or BMR", () => {
    const small = {
      ...rahul,
      sex: "FEMALE" as const,
      weightKg: 48,
      heightCm: 150,
      activityLevel: "SEDENTARY" as const,
      bodyFatPct: undefined,
    };
    const plan = planGoal(small, {
      type: "FAT_LOSS",
      targetWeightKg: 40,
      startDate: start,
      targetDate: weeksLater(4),
    });
    expect(plan.kcal).toBeGreaterThanOrEqual(1200);
    expect(plan.kcal).toBeGreaterThanOrEqual(Math.round(plan.bmr));
  });

  it("keeps muscle-gain surplus within 5–15% of TDEE", () => {
    const plan = planGoal(
      { ...rahul, weightKg: 60 },
      {
        type: "MUSCLE_GAIN",
        targetWeightKg: 65,
        startDate: start,
        targetDate: weeksLater(20),
      },
    );
    const pct = plan.dailyAdjustmentKcal / plan.tdee;
    expect(pct).toBeGreaterThanOrEqual(0.05 - 1e-9);
    expect(pct).toBeLessThanOrEqual(0.15 + 1e-9);
  });

  it("disables deficits for minors", () => {
    const plan = planGoal(
      { ...rahul, ageYears: 16 },
      {
        type: "FAT_LOSS",
        targetWeightKg: 75,
        startDate: start,
        targetDate: weeksLater(16),
      },
    );
    expect(plan.dailyAdjustmentKcal).toBeGreaterThanOrEqual(0);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
});

describe("macros", () => {
  it("splits calories into protein, fat and carbs", () => {
    const m = macrosFor(2257, 82, "FAT_LOSS");
    expect(m.proteinG).toBe(148);
    expect(m.fatG).toBe(63);
    const total = m.proteinG * 4 + m.fatG * 9 + m.carbsG * 4;
    expect(Math.abs(total - 2257)).toBeLessThan(10);
  });

  it("scales per-100 g values to a portion", () => {
    expect(scaleNutrition({ kcal: 264, protein: 8.9, carbs: 46, fat: 5 }, 80)).toEqual({
      kcal: 211.2,
      proteinG: 7.1,
      carbsG: 36.8,
      fatG: 4,
    });
  });
});
