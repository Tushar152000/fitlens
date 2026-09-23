import { prisma } from "@/lib/db";
import { ageFromBirthDate, bodyFatNavy, planGoal, type GoalPlan } from "@/lib/nutrition";

/** Recompute targets from the profile, latest body metric and active goal, and store a new DailyTarget. */
export async function recomputeTargets(userId: string, reason: string, effectiveFrom = new Date()) {
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
      startDate: effectiveFrom,
      targetDate: goal.targetDate,
    },
    { medicalFlag: profile.medicalFlag },
  );

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
