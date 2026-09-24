import { NextResponse } from "next/server";
import { HttpError, parseBody, requireUserId, route } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { computePlan, recomputeTargets } from "@/lib/services/targets";
import { GoalOptionSchema } from "@/lib/validators";

/**
 * Design 5b: the goal is too fast, so the user picks one of the two safe options.
 * KEEP_GOAL moves the date out; KEEP_DATE keeps the date and moves the target closer.
 */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const { choice } = await parseBody(req, GoalOptionSchema);
  const { plan, goal, profile } = await computePlan(userId);
  if (plan.feasible) return NextResponse.json({ ok: true, changed: false });

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
  let reason: string;
  if (choice === "KEEP_GOAL") {
    if (!plan.suggestedTargetDate) throw new HttpError(409, "No safer date to move to");
    await prisma.goal.update({
      where: { id: goal.id },
      data: { targetDate: plan.suggestedTargetDate },
    });
    reason = `Goal date moved to ${fmt(plan.suggestedTargetDate)} to keep a safe pace`;
  } else {
    if (plan.closerTargetWeightKg == null) throw new HttpError(409, "No closer target available");
    const target = Math.round(plan.closerTargetWeightKg * 2) / 2; // nearest 0.5 kg
    await prisma.goal.update({
      where: { id: goal.id },
      data: { targetWeightKg: target, targetBodyFatPct: null },
    });
    reason = `Target set to ${target} kg by ${fmt(goal.targetDate)} to keep a safe pace`;
  }

  const { target } = await recomputeTargets(userId, reason, localDate(profile.timezone));
  return NextResponse.json({ ok: true, changed: true, target });
});
