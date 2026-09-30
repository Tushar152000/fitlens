import { bmr as calcBmr, tdee as calcTdee } from "./body.js";
import { macrosFor } from "./macros.js";
import type { BodyStats, GoalInput, Macros } from "./types.js";

export const KCAL_PER_KG_FAT = 7700;
export const KCAL_FLOOR = { MALE: 1500, FEMALE: 1200 } as const;

/** Safety limits from PRD section 6. Rates are % of body weight per week. */
export const LIMITS = {
  fatLossMaxRatePct: 1.0,
  fatLossMaxDeficitPct: 0.25,
  gainMinSurplusPct: 0.05,
  gainMaxSurplusPct: 0.15,
  gainMaxRatePct: 0.5,
  recompDeficitPct: 0.05,
} as const;

export interface GoalPlan extends Macros {
  bmr: number;
  tdee: number;
  targetWeightKg: number;
  weeks: number;
  weeklyChangeKg: number; // the plan's actual pace after every cap; negative = losing
  /** The pace the user's own date would need (design 5b headline). */
  neededWeeklyChangeKg: number;
  weeklyRatePct: number; // absolute % of body weight per week
  dailyAdjustmentKcal: number; // negative = deficit
  feasible: boolean;
  /** 5b "Keep the goal": when the target is reached at the safe pace. */
  suggestedTargetDate?: Date;
  /** 5b "Keep the date": where the safe pace gets you by the original date. */
  closerTargetWeightKg?: number;
  warnings: string[];
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function resolveTargetWeight(stats: BodyStats, goal: GoalInput): number {
  if (goal.targetBodyFatPct != null && stats.bodyFatPct != null) {
    const leanMass = stats.weightKg * (1 - stats.bodyFatPct / 100);
    return leanMass / (1 - goal.targetBodyFatPct / 100);
  }
  if (goal.targetWeightKg != null) return goal.targetWeightKg;
  return stats.weightKg;
}

/** Turn body stats + a dated goal into safe daily calorie and macro targets. */
export function planGoal(
  stats: BodyStats,
  goal: GoalInput,
  opts: { medicalFlag?: boolean } = {},
): GoalPlan {
  const warnings: string[] = [];
  const bmr = calcBmr(stats.sex, stats.weightKg, stats.heightCm, stats.ageYears);
  const tdee = calcTdee(bmr, stats.activityLevel);
  const floor = Math.max(KCAL_FLOOR[stats.sex], bmr);

  const weeks = Math.max(1, (goal.targetDate.getTime() - goal.startDate.getTime()) / MS_PER_WEEK);
  const targetWeightKg =
    goal.type === "RECOMPOSITION" ? stats.weightKg : resolveTargetWeight(stats, goal);
  const totalChangeKg = targetWeightKg - stats.weightKg;

  let weeklyChangeKg = totalChangeKg / weeks;
  const neededWeeklyChangeKg = weeklyChangeKg;
  let feasible = true;
  let suggestedTargetDate: Date | undefined;
  let adjustment = 0;

  const suggestDate = (maxWeeklyKg: number) => {
    const neededWeeks = Math.ceil(Math.abs(totalChangeKg) / maxWeeklyKg);
    return new Date(goal.startDate.getTime() + neededWeeks * MS_PER_WEEK);
  };

  if (stats.ageYears < 18 || opts.medicalFlag) {
    warnings.push(
      "Calorie deficits are disabled for under-18s and flagged medical conditions. Please consult a professional.",
    );
    adjustment = 0;
    weeklyChangeKg = 0;
  } else if (goal.type === "FAT_LOSS") {
    if (totalChangeKg >= 0) warnings.push("Target is not below current weight; nothing to lose.");
    const maxWeeklyKg = (stats.weightKg * LIMITS.fatLossMaxRatePct) / 100;
    if (-weeklyChangeKg > maxWeeklyKg) {
      feasible = false;
      suggestedTargetDate = suggestDate(maxWeeklyKg);
      weeklyChangeKg = -maxWeeklyKg;
      warnings.push(
        `Losing more than ${LIMITS.fatLossMaxRatePct}% of body weight per week is not recommended; capped the rate.`,
      );
    }
    adjustment = Math.min(0, (weeklyChangeKg * KCAL_PER_KG_FAT) / 7);
    const maxDeficit = tdee * LIMITS.fatLossMaxDeficitPct;
    if (-adjustment > maxDeficit) {
      adjustment = -maxDeficit;
      warnings.push("Deficit capped at 25% of maintenance calories.");
    }
  } else if (goal.type === "MUSCLE_GAIN") {
    if (totalChangeKg <= 0) warnings.push("Target is not above current weight; nothing to gain.");
    const maxWeeklyKg = (stats.weightKg * LIMITS.gainMaxRatePct) / 100;
    if (weeklyChangeKg > maxWeeklyKg) {
      feasible = false;
      suggestedTargetDate = suggestDate(maxWeeklyKg);
      weeklyChangeKg = maxWeeklyKg;
      warnings.push("Gaining faster than 0.5% per week mostly adds fat; capped the rate.");
    }
    const wanted = (Math.max(0, weeklyChangeKg) * KCAL_PER_KG_FAT) / 7;
    adjustment = Math.min(
      tdee * LIMITS.gainMaxSurplusPct,
      Math.max(tdee * LIMITS.gainMinSurplusPct, wanted),
    );
  } else {
    adjustment = -tdee * LIMITS.recompDeficitPct;
    weeklyChangeKg = 0;
  }

  let kcal = tdee + adjustment;
  if (kcal < floor) {
    kcal = floor;
    warnings.push("Calories raised to the safe minimum.");
  }
  adjustment = kcal - tdee;

  // The pace the final calories actually deliver, after the rate cap, the 25% deficit cap and the
  // calorie floor. A goal is only feasible if this pace reaches it by the date (design 5b).
  const directional = goal.type === "FAT_LOSS" || goal.type === "MUSCLE_GAIN";
  if (directional && weeklyChangeKg !== 0 && Math.abs(totalChangeKg) > 0.05) {
    const effective = (adjustment * 7) / KCAL_PER_KG_FAT;
    const sameDirection = Math.sign(effective) === Math.sign(totalChangeKg);
    if (sameDirection && Math.abs(effective) > 1e-6) {
      weeklyChangeKg = effective;
      if (Math.abs(neededWeeklyChangeKg) > Math.abs(effective) * 1.02) {
        feasible = false;
        const neededWeeks = Math.ceil(Math.abs(totalChangeKg / effective));
        suggestedTargetDate = new Date(goal.startDate.getTime() + neededWeeks * MS_PER_WEEK);
      }
    }
  }
  const closerTargetWeightKg = feasible ? undefined : stats.weightKg + weeklyChangeKg * weeks;

  const macros = macrosFor(Math.round(kcal), stats.weightKg, goal.type);

  return {
    ...macros,
    bmr,
    tdee,
    targetWeightKg,
    weeks,
    weeklyChangeKg,
    neededWeeklyChangeKg,
    weeklyRatePct: Math.abs((weeklyChangeKg / stats.weightKg) * 100),
    dailyAdjustmentKcal: adjustment,
    feasible,
    suggestedTargetDate,
    closerTargetWeightKg,
    warnings,
  };
}
