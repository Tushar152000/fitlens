import { prisma } from "@/lib/db";
import {
  ageFromBirthDate,
  bmi,
  bmiCategory,
  bodyFatNavy,
  planGoal,
  type GoalPlan,
} from "@/lib/nutrition";

/** Plan from the profile, latest body metric and active goal. Pure read — stores nothing.
 * `effectiveFrom` defaults to the goal's start date, which reproduces the onboarding plan. */
export async function computePlan(userId: string, effectiveFrom?: Date) {
  const [profile, metric, goal] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.bodyMetric.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.goal.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!profile || !metric || !goal) throw new Error("Profile, body metric and goal are required");

  const bodyFatPct =
    metric.bodyFatPct ??
    (metric.waistCm && metric.neckCm
      ? (bodyFatNavy({
          sex: profile.sex,
          heightCm: profile.heightCm,
          waistCm: metric.waistCm,
          neckCm: metric.neckCm,
          hipCm: metric.hipCm ?? undefined,
        }) ?? undefined)
      : undefined);

  const plan: GoalPlan = planGoal(
    {
      sex: profile.sex,
      ageYears: ageFromBirthDate(profile.birthDate),
      heightCm: profile.heightCm,
      weightKg: metric.weightKg,
      activityLevel: profile.activityLevel,
      bodyFatPct,
    },
    {
      type: goal.type,
      targetWeightKg: goal.targetWeightKg ?? undefined,
      targetBodyFatPct: goal.targetBodyFatPct ?? undefined,
      startDate: effectiveFrom ?? goal.startDate,
      targetDate: goal.targetDate,
    },
    { medicalFlag: profile.medicalFlag },
  );

  return { plan, profile, metric, goal, bodyFatPct };
}

/** Recompute targets and store a new DailyTarget. */
export async function recomputeTargets(userId: string, reason: string, effectiveFrom = new Date()) {
  const { plan, goal } = await computePlan(userId, effectiveFrom);
  const target = await prisma.dailyTarget.create({
    data: {
      userId,
      goalId: goal.id,
      effectiveFrom,
      kcal: plan.kcal,
      proteinG: plan.proteinG,
      carbsG: plan.carbsG,
      fatG: plan.fatG,
      reason,
    },
  });
  return { target, plan };
}

export function currentTarget(userId: string, onDate = new Date()) {
  return prisma.dailyTarget.findFirst({
    where: { userId, effectiveFrom: { lte: onDate } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The "Your plan" payload: returned by POST /api/onboarding and rendered by /onboarding/plan. */
export function planSummary<
  T extends { kcal: number; proteinG: number; carbsG: number; fatG: number },
>(input: {
  plan: GoalPlan;
  weightKg: number;
  heightCm: number;
  bodyFatPct: number | null | undefined;
  target: T;
}) {
  const { plan } = input;
  const bmiValue = bmi(input.weightKg, input.heightCm);
  return {
    bmi: { value: round1(bmiValue), category: bmiCategory(bmiValue) },
    bodyFatPct: input.bodyFatPct != null ? round1(input.bodyFatPct) : null,
    target: input.target,
    plan: {
      bmr: Math.round(plan.bmr),
      tdee: Math.round(plan.tdee),
      targetWeightKg: round1(plan.targetWeightKg),
      weeklyChangeKg: Math.round(plan.weeklyChangeKg * 100) / 100,
      neededWeeklyChangeKg: Math.round(plan.neededWeeklyChangeKg * 100) / 100,
      feasible: plan.feasible,
      suggestedTargetDate: plan.suggestedTargetDate?.toISOString().slice(0, 10),
      closerTargetWeightKg:
        plan.closerTargetWeightKg != null ? round1(plan.closerTargetWeightKg) : undefined,
      warnings: plan.warnings,
    },
  };
}

export type PlanSummary = ReturnType<
  typeof planSummary<{ kcal: number; proteinG: number; carbsG: number; fatG: number }>
>;
