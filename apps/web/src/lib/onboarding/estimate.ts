import {
  bodyFatNavy,
  planGoal,
  PREVIEW_PACE_PCT,
  PREVIEW_WEEKS,
  type GoalType,
} from "@fitr8/domain/nutrition";
import { needsTarget, type OnboardingDraft } from "./draft";

export interface DraftEstimate {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  goalType: GoalType;
  /** True when the goal step is complete, so this is the plan onboarding will save. */
  exact: boolean;
  targetWeightKg: number;
}

const MS_PER_WEEK = 7 * 86_400_000;
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

function ageOn(birthDate: string, today: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const b = new Date(`${birthDate}T00:00:00Z`);
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

/**
 * Live daily target shown while someone fills in onboarding. Display only: the API computes the
 * saved plan with the same @fitr8/domain rules. Until the goal step is complete it assumes the
 * landing-page preview pace. Null until sex, age, height, weight and activity are known.
 */
export function estimateFromDraft(
  d: OnboardingDraft,
  opts: { today?: Date; fallbackAgeYears?: number | null } = {},
): DraftEstimate | null {
  const today = opts.today ?? new Date();
  const ageYears = ageOn(d.birthDate, today) ?? opts.fallbackAgeYears ?? null;
  const heightCm = num(d.heightCm);
  const weightKg = num(d.weightKg);
  if (!d.sex || !d.activityLevel || ageYears == null || ageYears < 13 || ageYears > 100)
    return null;
  if (!(heightCm >= 120 && heightCm <= 230 && weightKg >= 30 && weightKg <= 250)) return null;

  const bodyFatPct =
    bodyFatNavy({
      sex: d.sex,
      heightCm,
      waistCm: num(d.waistCm),
      neckCm: num(d.neckCm),
      hipCm: d.sex === "FEMALE" ? num(d.hipCm) : undefined,
    }) ?? undefined;
  const stats = {
    sex: d.sex,
    ageYears,
    heightCm,
    weightKg,
    activityLevel: d.activityLevel,
    bodyFatPct,
  };

  const goalType = d.goalType ?? "FAT_LOSS";
  const targetWeightKg = num(d.targetWeightKg);
  const targetBodyFatPct = num(d.targetBodyFatPct);
  const dated = /^\d{4}-\d{2}-\d{2}$/.test(d.targetDate) && new Date(d.targetDate) > today;
  const hasTarget = !needsTarget(d)
    ? true
    : d.targetMode === "WEIGHT"
      ? targetWeightKg >= 30 && targetWeightKg <= 250
      : targetBodyFatPct >= 5 && targetBodyFatPct <= 50 && bodyFatPct != null;
  const exact = d.goalType !== undefined && dated && hasTarget;

  const change =
    (goalType === "FAT_LOSS" ? -1 : 1) * (PREVIEW_PACE_PCT[goalType] / 100) * PREVIEW_WEEKS;
  const plan = planGoal(
    stats,
    exact
      ? {
          type: goalType,
          targetWeightKg: needsTarget(d) && d.targetMode === "WEIGHT" ? targetWeightKg : undefined,
          targetBodyFatPct:
            needsTarget(d) && d.targetMode === "BODY_FAT" ? targetBodyFatPct : undefined,
          startDate: today,
          targetDate: new Date(`${d.targetDate}T00:00:00Z`),
        }
      : {
          type: goalType,
          targetWeightKg: goalType === "RECOMPOSITION" ? undefined : weightKg * (1 + change),
          startDate: today,
          targetDate: new Date(today.getTime() + PREVIEW_WEEKS * MS_PER_WEEK),
        },
    { medicalFlag: d.medicalFlag },
  );

  return {
    kcal: plan.kcal,
    proteinG: plan.proteinG,
    carbsG: plan.carbsG,
    fatG: plan.fatG,
    goalType,
    exact,
    targetWeightKg: plan.targetWeightKg,
  };
}
