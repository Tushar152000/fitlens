import { KCAL_FLOOR, planGoal } from "./goal.js";
import type { BodyStats, GoalType, Macros } from "./types.js";
import { waterTarget } from "./water.js";

/**
 * Signed-out "see your daily target" preview (landing page). There is no dated goal yet, so it
 * assumes a steady pace over PREVIEW_WEEKS and runs the same planGoal rules as onboarding: rate
 * caps, the 25% deficit cap, the 5–15% surplus band and the calorie floor.
 */
export const PREVIEW_WEEKS = 12;

/** Assumed pace as % of body weight per week: under the 1% fat-loss cap and the 0.5% gain cap. */
export const PREVIEW_PACE_PCT: Record<GoalType, number> = {
  FAT_LOSS: 0.75,
  MUSCLE_GAIN: 0.25,
  RECOMPOSITION: 0,
};

export interface TargetPreview extends Macros {
  bmr: number;
  tdee: number;
  /** kcal/day vs maintenance after every cap; negative = deficit. */
  dailyAdjustmentKcal: number;
  /** The pace those calories deliver, kg/week; negative = losing. */
  weeklyChangeKg: number;
  /** Drinking-water target on a rest day. */
  waterMl: number;
  /** Under 18: no deficit or surplus. */
  noAdjustment: boolean;
  /** Calories were lifted to the safe minimum. */
  raisedToFloor: boolean;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function previewTarget(
  stats: Omit<BodyStats, "bodyFatPct">,
  goal: GoalType,
  today: Date = new Date(),
): TargetPreview {
  const change = (goal === "FAT_LOSS" ? -1 : 1) * (PREVIEW_PACE_PCT[goal] / 100) * PREVIEW_WEEKS;
  const plan = planGoal(stats, {
    type: goal,
    targetWeightKg: goal === "RECOMPOSITION" ? undefined : stats.weightKg * (1 + change),
    startDate: today,
    targetDate: new Date(today.getTime() + PREVIEW_WEEKS * MS_PER_WEEK),
  });
  const floor = Math.round(Math.max(KCAL_FLOOR[stats.sex], plan.bmr));

  return {
    kcal: plan.kcal,
    proteinG: plan.proteinG,
    carbsG: plan.carbsG,
    fatG: plan.fatG,
    bmr: plan.bmr,
    tdee: plan.tdee,
    dailyAdjustmentKcal: plan.dailyAdjustmentKcal,
    weeklyChangeKg: (plan.dailyAdjustmentKcal * 7) / 7700,
    waterMl: waterTarget({
      weightKg: stats.weightKg,
      activityLevel: stats.activityLevel,
      trainingDay: false,
      goalType: goal,
      medicalFlag: false,
    }).ml,
    noAdjustment: stats.ageYears < 18,
    raisedToFloor: plan.kcal === floor && plan.tdee > floor,
  };
}
