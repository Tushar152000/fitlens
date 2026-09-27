import { NextResponse } from "next/server";
import { HttpError, requireUserId, route } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { computePlan, currentTarget, planSummary } from "@/lib/services/targets";

/**
 * Screen 5 data, rebuilt from the database: the plan summary plus the active goal and latest body
 * metric (the app also uses these to prefill onboarding when the goal is edited).
 */
export const GET = route(async () => {
  const userId = await requireUserId();
  let computed;
  try {
    computed = await computePlan(userId);
  } catch {
    throw new HttpError(404, "Finish onboarding first");
  }
  const { plan, metric, goal, profile, bodyFatPct } = computed;
  const target = await currentTarget(userId, localDate(profile.timezone));
  if (!target) throw new HttpError(404, "Finish onboarding first");

  return NextResponse.json({
    summary: planSummary({ plan, target, weightKg: metric.weightKg, heightCm: profile.heightCm, bodyFatPct }),
    goal: {
      type: goal.type,
      targetDate: goal.targetDate.toISOString().slice(0, 10),
      targetWeightKg: goal.targetWeightKg,
      targetBodyFatPct: goal.targetBodyFatPct,
    },
    metric: {
      date: metric.date.toISOString().slice(0, 10),
      bodyFatPct: metric.bodyFatPct,
      weightKg: metric.weightKg,
      waistCm: metric.waistCm,
      neckCm: metric.neckCm,
      hipCm: metric.hipCm,
    },
    training: { daysPerWeek: profile.trainingDaysPerWeek, sessionMinutes: profile.sessionMinutes },
  });
});
