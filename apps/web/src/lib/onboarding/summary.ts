import type { OnboardingDraft } from "./draft";
import { ageOn } from "./estimate";

const SEX = { MALE: "Male", FEMALE: "Female" } as const;
const ACTIVITY = {
  SEDENTARY: "Mostly sitting",
  LIGHT: "Lightly active",
  MODERATE: "Moderately active",
  VERY_ACTIVE: "Very active",
  ATHLETE: "Athlete",
} as const;
const DIET = { VEG: "Veg", NON_VEG: "Non-veg", EGGETARIAN: "Eggetarian", VEGAN: "Vegan" } as const;
const WHERE = { FULL_GYM: "Gym", DUMBBELLS: "Home", BODYWEIGHT: "Anywhere" } as const;

const has = (s: string) => s.trim() !== "";

/**
 * One-line answers for the folded sections of "About you", e.g. "Male · 31 yrs · 175 cm · 78 kg ·
 * Moderately active". Only what's been answered; empty when nothing has.
 */
export function bodySummary(d: OnboardingDraft, today = new Date()): string {
  const age = ageOn(d.birthDate, today);
  return [
    d.sex && SEX[d.sex],
    age != null && age >= 0 && `${age} yrs`,
    has(d.heightCm) && `${d.heightCm.trim()} cm`,
    has(d.weightKg) && `${d.weightKg.trim()} kg`,
    d.activityLevel && ACTIVITY[d.activityLevel],
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "Non-veg · Gym · 4 days · 45 min" (days and minutes have defaults, so they're always there). */
export function trainingSummary(d: OnboardingDraft): string {
  return [
    d.dietType && DIET[d.dietType],
    d.equipment && WHERE[d.equipment],
    `${d.trainingDaysPerWeek} days`,
    `${d.sessionMinutes} min`,
  ]
    .filter(Boolean)
    .join(" · ");
}
