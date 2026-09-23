import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { localDate, parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { bmi, bmiCategory, bodyFatNavy } from "@/lib/nutrition";
import { recomputeTargets } from "@/lib/services/targets";
import { OnboardingSchema } from "@/lib/validators";

/** Save profile, first body metric and goal, then compute targets. Re-running replaces the active goal. */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const input = await parseBody(req, OnboardingSchema);
  const today = localDate(input.timezone);

  const bodyFatPct =
    input.waistCm && input.neckCm
      ? bodyFatNavy({
          sex: input.sex,
          heightCm: input.heightCm,
          waistCm: input.waistCm,
          neckCm: input.neckCm,
          hipCm: input.hipCm,
        })
      : null;

  const profileData = {
    sex: input.sex,
    birthDate: parseDateOnly(input.birthDate),
    heightCm: input.heightCm,
    activityLevel: input.activityLevel,
    dietType: input.dietType,
    experience: input.experience,
    equipment: input.equipment,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    sessionMinutes: input.sessionMinutes,
    injuries: input.injuries,
    medicalFlag: input.medicalFlag,
    timezone: input.timezone,
    onboardedAt: new Date(),
  };

  await prisma.$transaction([
    prisma.profile.upsert({
      where: { userId },
      create: { userId, ...profileData },
      update: profileData,
    }),
    prisma.bodyMetric.upsert({
      where: { userId_date: { userId, date: today } },
      create: {
        userId,
        date: today,
        weightKg: input.weightKg,
        waistCm: input.waistCm,
        neckCm: input.neckCm,
        hipCm: input.hipCm,
        bodyFatPct,
      },
      update: {
        weightKg: input.weightKg,
        waistCm: input.waistCm,
        neckCm: input.neckCm,
        hipCm: input.hipCm,
        bodyFatPct,
      },
    }),
    prisma.goal.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "ABANDONED" } }),
    prisma.goal.create({
      data: {
        userId,
        type: input.goal.type,
        startWeightKg: input.weightKg,
        startBodyFatPct: bodyFatPct,
        targetWeightKg: input.goal.targetWeightKg,
        targetBodyFatPct: input.goal.targetBodyFatPct,
        startDate: today,
        targetDate: parseDateOnly(input.goal.targetDate),
      },
    }),
  ]);

  const { target, plan } = await recomputeTargets(userId, "Initial targets from onboarding", today);
  const bmiValue = bmi(input.weightKg, input.heightCm);

  return NextResponse.json(
    {
      bmi: { value: Math.round(bmiValue * 10) / 10, category: bmiCategory(bmiValue) },
      bodyFatPct: bodyFatPct && Math.round(bodyFatPct * 10) / 10,
      target,
      plan: {
        bmr: Math.round(plan.bmr),
        tdee: Math.round(plan.tdee),
        targetWeightKg: Math.round(plan.targetWeightKg * 10) / 10,
        weeklyChangeKg: Math.round(plan.weeklyChangeKg * 100) / 100,
        feasible: plan.feasible,
        suggestedTargetDate: plan.suggestedTargetDate?.toISOString().slice(0, 10),
        warnings: plan.warnings,
      },
    },
    { status: 201 },
  );
});
