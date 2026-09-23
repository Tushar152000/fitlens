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
