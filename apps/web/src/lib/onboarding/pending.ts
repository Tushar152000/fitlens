import type { ActivityLevel, GoalType, Sex } from "@fitr8/domain/nutrition";
import type { OnboardingDraft } from "./draft";

/** What the visitor typed into the landing-page calculator, to prefill onboarding. */
export const CALCULATOR_KEY = "fitr8.onboarding.calculator";

export interface CalculatorNumbers {
  goal: GoalType;
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode): onboarding just starts without the calculator numbers.
  }
}

export const stashCalculator = (c: CalculatorNumbers) => write(CALCULATOR_KEY, c);

/** Parses the raw calculator entry; anything malformed is ignored. */
export function parseCalculator(raw: string | null): CalculatorNumbers | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<CalculatorNumbers>;
    const ok =
      typeof c.goal === "string" &&
      (c.sex === "MALE" || c.sex === "FEMALE") &&
      typeof c.activity === "string" &&
      [c.ageYears, c.heightCm, c.weightKg].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      );
    return ok ? (c as CalculatorNumbers) : null;
  } catch {
    return null;
  }
}

/** The calculator numbers as draft fields (date of birth is unknown, only an age). */
export function draftFromCalculator(c: CalculatorNumbers): Partial<OnboardingDraft> {
  return {
    goalType: c.goal,
    sex: c.sex,
    heightCm: String(c.heightCm),
    weightKg: String(c.weightKg),
    activityLevel: c.activity,
  };
}
