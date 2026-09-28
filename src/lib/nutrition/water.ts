import type { ActivityLevel, GoalType } from "./types";

/**
 * Daily drinking-water target. Numbers never come from an LLM.
 * - 33 ml per kg of body weight (within the usual 30–35 ml/kg guidance for adults),
 * - plus more for daily activity outside workouts,
 * - plus 0.5 L on training days (sweat losses in a ~45 min session),
 * rounded to 100 ml and kept within 1.5–4.5 L.
 * Food and other drinks cover the rest of total water needs.
 */
export const ML_PER_KG = 33;
export const TRAINING_DAY_ML = 500;
const MIN_ML = 1500;
const MAX_ML = 4500;

const ACTIVITY_ML: Record<ActivityLevel, number> = {
  SEDENTARY: 0,
  LIGHT: 250,
  MODERATE: 500,
  VERY_ACTIVE: 750,
  ATHLETE: 1000,
};

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  SEDENTARY: "",
  LIGHT: "light activity",
  MODERATE: "an active day",
  VERY_ACTIVE: "a very active day",
  ATHLETE: "athlete-level activity",
};

const GOAL_TIP: Record<GoalType, string> = {
  FAT_LOSS: "A glass before each meal also helps you feel full on fewer calories.",
  MUSCLE_GAIN: "More food and protein need more water to digest and recover.",
  RECOMPOSITION: "Steady water keeps training quality and recovery up.",
};

export interface WaterTarget {
  ml: number;
  /** One line with the numbers behind the target (design: "explain every change"). */
  reason: string;
  /** Goal-specific tip. */
  tip: string;
  /** Shown with a medical flag: follow a doctor's fluid advice instead. */
  caution: string | null;
}

export const litres = (ml: number) => `${(Math.round(ml / 100) / 10).toFixed(1)} L`;

export function waterTarget(input: {
  weightKg: number;
  activityLevel: ActivityLevel;
  trainingDay: boolean;
  goalType: GoalType | null;
  medicalFlag: boolean;
}): WaterTarget {
  const base = input.weightKg * ML_PER_KG;
  const activity = ACTIVITY_ML[input.activityLevel];
  const training = input.trainingDay ? TRAINING_DAY_ML : 0;
  const ml = Math.min(MAX_ML, Math.max(MIN_ML, Math.round((base + activity + training) / 100) * 100));

  const parts = [`${Math.round(input.weightKg)} kg × ${ML_PER_KG} ml`];
  if (activity) parts.push(`${activity} ml for ${ACTIVITY_LABEL[input.activityLevel]}`);
  if (training) parts.push(`${training} ml for today's workout`);
  const reason = `${parts.join(" + ")} ≈ ${litres(ml)}`;

  return {
    ml,
    reason,
    tip: input.goalType ? GOAL_TIP[input.goalType] : GOAL_TIP.RECOMPOSITION,
    caution: input.medicalFlag
      ? "If a doctor has limited your fluids (e.g. for heart or kidney health), follow their advice instead."
      : null,
  };
}
