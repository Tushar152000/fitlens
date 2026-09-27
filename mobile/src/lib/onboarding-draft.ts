/** Copied from the web app (src/app/(app)/onboarding/draft.ts). Keep the two in step. */
import type { ActivityLevel, DietType, Equipment, Experience, GoalType, Sex } from "./types";

/** Body of POST /api/onboarding (src/lib/validators OnboardingSchema). */
export interface OnboardingInput {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  waistCm?: number;
  neckCm?: number;
  hipCm?: number;
  activityLevel: ActivityLevel;
  dietType: DietType;
  experience: Experience;
  equipment: Equipment;
  trainingDaysPerWeek: number;
  sessionMinutes: number;
  injuries: string[];
  medicalFlag: boolean;
  timezone: string;
  goal: { type: GoalType; targetWeightKg?: number; targetBodyFatPct?: number; targetDate: string };
}

type P = OnboardingInput;

/** Form state. Number fields stay strings until submit so partial input like "72." is allowed. */
export interface OnboardingDraft {
  goalType?: P["goal"]["type"];
  targetMode: "WEIGHT" | "BODY_FAT";
  targetWeightKg: string;
  targetBodyFatPct: string;
  targetDate: string;
  sex?: P["sex"];
  birthDate: string;
  heightCm: string;
  weightKg: string;
  waistCm: string;
  neckCm: string;
  hipCm: string;
  activityLevel?: P["activityLevel"];
  dietType?: P["dietType"];
  experience?: P["experience"];
  equipment?: P["equipment"];
  trainingDaysPerWeek: number;
  sessionMinutes: number;
  injuries: string;
  medicalFlag: boolean;
}

export type DraftErrors = Partial<Record<keyof OnboardingDraft, string>>;

export const ymd = (d: Date) => d.toISOString().slice(0, 10);

const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

export function emptyDraft(today = new Date()): OnboardingDraft {
  return {
    targetMode: "WEIGHT",
    targetWeightKg: "",
    targetBodyFatPct: "",
    targetDate: ymd(addDays(today, 12 * 7)),
    birthDate: "",
    heightCm: "",
    weightKg: "",
    waistCm: "",
    neckCm: "",
    hipCm: "",
    trainingDaysPerWeek: 3,
    sessionMinutes: 45,
    injuries: "",
    medicalFlag: false,
  };
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

function range(
  errors: DraftErrors,
  key: keyof OnboardingDraft,
  raw: string,
  min: number,
  max: number,
  label: string,
  required: boolean,
) {
  const n = num(raw);
  if (n === undefined) {
    if (required) errors[key] = `Enter your ${label}`;
    return;
  }
  if (!Number.isFinite(n) || n < min || n > max)
    errors[key] = `Enter ${label} between ${min} and ${max}`;
}

export const needsTarget = (d: OnboardingDraft) =>
  d.goalType !== undefined && d.goalType !== "RECOMPOSITION";
export const wantsBodyFat = (d: OnboardingDraft) => needsTarget(d) && d.targetMode === "BODY_FAT";

/** Errors for one step (1–3). Empty object = OK to continue. */
export function validateStep(step: number, d: OnboardingDraft, today = new Date()): DraftErrors {
  const e: DraftErrors = {};
  if (step === 1) {
    if (!d.goalType) e.goalType = "Pick a goal";
    if (needsTarget(d)) {
      if (d.targetMode === "WEIGHT")
        range(e, "targetWeightKg", d.targetWeightKg, 30, 250, "target weight", true);
      else range(e, "targetBodyFatPct", d.targetBodyFatPct, 5, 50, "target body fat", true);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.targetDate)) e.targetDate = "Pick a target date";
    else if (d.targetDate <= ymd(addDays(today, 13)))
      e.targetDate = "Give yourself at least 2 weeks";
  }
  if (step === 2) {
    if (!d.sex) e.sex = "Choose one";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.birthDate)) e.birthDate = "Enter your date of birth";
    else {
      const age = (today.getTime() - new Date(d.birthDate).getTime()) / (365.25 * 86_400_000);
      if (age < 13 || age > 100) e.birthDate = "Check your date of birth";
    }
    range(e, "heightCm", d.heightCm, 120, 230, "height", true);
    range(e, "weightKg", d.weightKg, 30, 250, "weight", true);
    const bf = wantsBodyFat(d);
    range(e, "waistCm", d.waistCm, 40, 200, "waist", bf);
    range(e, "neckCm", d.neckCm, 20, 70, "neck", bf);
    if (d.sex === "FEMALE") range(e, "hipCm", d.hipCm, 50, 200, "hip", bf);
    const waist = num(d.waistCm);
    const neck = num(d.neckCm);
    if (!e.waistCm && !e.neckCm && waist && neck && waist <= neck) {
      e.waistCm = "Waist must be bigger than neck";
    }
    if (!d.activityLevel) e.activityLevel = "Pick the closest match";
  }
  if (step === 3) {
    if (!d.dietType) e.dietType = "Pick your diet";
    if (!d.equipment) e.equipment = "Pick what you can use";
  }
  return e;
}

/** Draft → POST /api/onboarding body. Call only after all steps validate. */
export function toPayload(d: OnboardingDraft, timezone: string): OnboardingInput {
  const target = needsTarget(d);
  return {
    sex: d.sex!,
    birthDate: d.birthDate,
    heightCm: Number(d.heightCm),
    weightKg: Number(d.weightKg),
    waistCm: num(d.waistCm),
    neckCm: num(d.neckCm),
    hipCm: d.sex === "FEMALE" ? num(d.hipCm) : undefined,
    activityLevel: d.activityLevel!,
    dietType: d.dietType!,
    // Not asked in onboarding (design 4); workouts start at beginner and progress from logs.
    experience: d.experience ?? "BEGINNER",
    equipment: d.equipment!,
    trainingDaysPerWeek: d.trainingDaysPerWeek,
    sessionMinutes: d.sessionMinutes,
    injuries: d.injuries
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10),
    medicalFlag: d.medicalFlag,
    timezone,
    goal: {
      type: d.goalType!,
      targetWeightKg: target && d.targetMode === "WEIGHT" ? Number(d.targetWeightKg) : undefined,
      targetBodyFatPct:
        target && d.targetMode === "BODY_FAT" ? Number(d.targetBodyFatPct) : undefined,
      targetDate: d.targetDate,
    },
  };
}
