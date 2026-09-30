import type { ActivityLevel, Sex } from "./types.js";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  VERY_ACTIVE: 1.725,
  ATHLETE: 1.9,
};

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(value: number): "underweight" | "normal" | "overweight" | "obese" {
  if (value < 18.5) return "underweight";
  if (value < 25) return "normal";
  if (value < 30) return "overweight";
  return "obese";
}

/** US Navy body-fat estimate. All measurements in cm. Returns null if inputs are impossible. */
export function bodyFatNavy(input: {
  sex: Sex;
  heightCm: number;
  waistCm: number;
  neckCm: number;
  hipCm?: number;
}): number | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = input;
  let bf: number;
  if (sex === "MALE") {
    if (waistCm <= neckCm) return null;
    bf =
      495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) -
      450;
  } else {
    if (hipCm == null || waistCm + hipCm <= neckCm) return null;
    bf =
      495 /
        (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) -
      450;
  }
  if (!Number.isFinite(bf) || bf < 2 || bf > 70) return null;
  return bf;
}

/** Mifflin-St Jeor basal metabolic rate, kcal/day. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === "MALE" ? 5 : -161);
}

export function tdee(bmrKcal: number, activity: ActivityLevel): number {
  return bmrKcal * ACTIVITY_FACTORS[activity];
}

export function ageFromBirthDate(birthDate: Date, today = new Date()): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}
