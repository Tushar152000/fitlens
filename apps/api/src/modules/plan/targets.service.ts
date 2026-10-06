import { AppError } from "../../common/errors.js";
import { Injectable } from "@nestjs/common";
import {
  ageFromBirthDate,
  bmi,
  bmiCategory,
  bodyFatNavy,
  planGoal,
  type GoalPlan,
} from "@fitr8/domain/nutrition";
import { PrismaService } from "../../infra/prisma/prisma.service.js";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Calorie and macro targets: the plan maths lives in @fitr8/domain; this reads its inputs and stores results. */
@Injectable()
export class TargetsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Plan from the profile, latest body metric and active goal. Pure read — stores nothing.
   * `effectiveFrom` defaults to the goal's start date, which reproduces the onboarding plan. */
  async computePlan(userId: string, effectiveFrom?: Date) {
    const [profile, metric, goal] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.bodyMetric.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
      this.prisma.goal.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    if (!profile || !metric || !goal) throw new AppError(404, "Finish onboarding first");

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
  async recomputeTargets(userId: string, reason: string, effectiveFrom = new Date()) {
    const { plan, goal } = await this.computePlan(userId, effectiveFrom);
    const target = await this.prisma.dailyTarget.create({
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

  /** The target in effect on a (local, UTC-midnight) date, or null before onboarding. */
  currentTarget(userId: string, onDate = new Date()) {
    return this.prisma.dailyTarget.findFirst({
      where: { userId, effectiveFrom: { lte: onDate } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });
  }
}

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
