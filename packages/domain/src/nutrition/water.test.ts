import { describe, expect, it } from "vitest";
import { litres, waterTarget } from "./water.js";

const base = {
  activityLevel: "LIGHT" as const,
  trainingDay: false,
  goalType: "FAT_LOSS" as const,
  medicalFlag: false,
};

describe("water target", () => {
  it("scales with weight and activity, and explains the numbers", () => {
    const t = waterTarget({ ...base, weightKg: 82 });
    // 82 × 33 = 2706 + 250 = 2956 → 3.0 L
    expect(t.ml).toBe(3000);
    expect(t.reason).toBe("82 kg × 33 ml + 250 ml for light activity ≈ 3.0 L");
    expect(t.tip).toMatch(/before each meal/);
    expect(t.caution).toBeNull();
  });

  it("adds 0.5 L on training days", () => {
    const rest = waterTarget({ ...base, weightKg: 70 });
    const train = waterTarget({ ...base, weightKg: 70, trainingDay: true });
    expect(train.ml - rest.ml).toBe(500);
    expect(train.reason).toMatch(/500 ml for today's workout/);
  });

  it("stays within 1.5–4.5 L", () => {
    expect(waterTarget({ ...base, weightKg: 35, activityLevel: "SEDENTARY" }).ml).toBe(1500);
    expect(
      waterTarget({ ...base, weightKg: 150, activityLevel: "ATHLETE", trainingDay: true }).ml,
    ).toBe(4500);
  });

  it("defers to a doctor with a medical flag", () => {
    expect(waterTarget({ ...base, weightKg: 60, medicalFlag: true }).caution).toMatch(/doctor/);
  });

  it("formats litres", () => {
    expect(litres(2956)).toBe("3.0 L");
    expect(litres(250)).toBe("0.3 L");
  });
});
