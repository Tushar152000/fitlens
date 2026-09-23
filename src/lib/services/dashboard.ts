import { prisma } from "@/lib/db";
import { sumMacros } from "@/lib/nutrition";
import { currentTarget } from "./targets";

export async function getDay(userId: string, date: Date) {
  const [target, meals] = await Promise.all([
    currentTarget(userId, date),
    prisma.mealLog.findMany({
      where: { userId, date },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const confirmed = meals.filter((m) => m.status === "CONFIRMED");
  const eaten = sumMacros(
    confirmed.map((m) => ({
      kcal: m.totalKcal,
      proteinG: m.totalProtein,
      carbsG: m.totalCarbs,
      fatG: m.totalFat,
    })),
  );

  return {
    date: date.toISOString().slice(0, 10),
    target: target && {
      kcal: target.kcal,
      proteinG: target.proteinG,
      carbsG: target.carbsG,
      fatG: target.fatG,
      reason: target.reason,
    },
    eaten,
    remainingKcal: target ? Math.round(target.kcal - eaten.kcal) : null,
    meals,
  };
}

const DAY_MS = 86_400_000;

/**
 * Consecutive days with at least one confirmed meal, ending today — or yesterday, so the
 * streak doesn't read 0 before breakfast is logged.
 */
export async function loggingStreak(userId: string, today: Date): Promise<number> {
  const rows = await prisma.mealLog.findMany({
    where: {
      userId,
      status: "CONFIRMED",
      date: { lte: today, gte: new Date(today.getTime() - 365 * DAY_MS) },
    },
    select: { date: true },
    distinct: ["date"],
    orderBy: { date: "desc" },
  });
  const days = new Set(rows.map((r) => r.date.getTime()));
  let cursor = days.has(today.getTime()) ? today.getTime() : today.getTime() - DAY_MS;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}
