import type { GoalType } from "./types";

/** GET /api/plan and POST /api/onboarding (src/lib/services/targets planSummary). */
export interface PlanSummary {
  bmi: { value: number; category: string };
  bodyFatPct: number | null;
  target: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  plan: {
    bmr: number;
    tdee: number;
    targetWeightKg: number;
    weeklyChangeKg: number;
    neededWeeklyChangeKg: number;
    feasible: boolean;
    suggestedTargetDate?: string;
    closerTargetWeightKg?: number;
    warnings: string[];
  };
}

export interface PlanResponse {
  summary: PlanSummary;
  goal: { type: GoalType; targetDate: string; targetWeightKg: number | null; targetBodyFatPct: number | null };
  metric: {
    date: string;
    bodyFatPct: number | null;
    weightKg: number;
    waistCm: number | null;
    neckCm: number | null;
    hipCm: number | null;
  };
  training: { daysPerWeek: number; sessionMinutes: number };
}
