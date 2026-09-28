import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http-error";
import { waterTarget } from "@/lib/nutrition";
import { getOrCreateWeek } from "./workouts";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Today's water: the target (with the numbers behind it), what's been drunk, and each log for undo. */
export async function getWater(userId: string, date: Date) {
  const [profile, metric, goal, logs] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: { activityLevel: true, medicalFlag: true, remindWater: true },
    }),
    prisma.bodyMetric.findFirst({ where: { userId }, orderBy: { date: "desc" }, select: { weightKg: true } }),
    prisma.goal.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { type: true },
    }),
    prisma.waterLog.findMany({
      where: { userId, date },
      orderBy: { createdAt: "asc" },
      select: { id: true, ml: true, createdAt: true },
    }),
  ]);
  if (!profile || !metric) throw new HttpError(404, "Finish onboarding first");

  const { week } = await getOrCreateWeek(userId, date);
  const trainingDay = week.days.some((d) => d.date === ymd(date));
  const target = waterTarget({
    weightKg: metric.weightKg,
    activityLevel: profile.activityLevel,
    trainingDay,
    goalType: goal?.type ?? null,
    medicalFlag: profile.medicalFlag,
  });

  return {
    date: ymd(date),
    targetMl: target.ml,
    reason: target.reason,
    tip: target.tip,
    caution: target.caution,
    trainingDay,
    consumedMl: logs.reduce((t, l) => t + l.ml, 0),
    logs,
    remind: profile.remindWater,
  };
}

export type WaterDay = Awaited<ReturnType<typeof getWater>>;

export function addWater(userId: string, date: Date, ml: number) {
  return prisma.waterLog.create({ data: { userId, date, ml } });
}

/** Undo one tap. Only the owner's rows. */
export async function deleteWater(userId: string, id: string) {
  const { count } = await prisma.waterLog.deleteMany({ where: { id, userId } });
  if (!count) throw new HttpError(404, "Water entry not found");
}
