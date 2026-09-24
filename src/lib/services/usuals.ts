import { prisma } from "@/lib/db";
import type { MealType } from "@/lib/format";
import { localDate } from "@/lib/dates";

const DAY = 86_400_000;

/** Same foods in the same amounts = the same "usual", whatever meal slot it was logged in. */
function signature(items: { name: string; quantity: number; unit: string }[]) {
  return items
    .map((i) => `${i.name}|${i.quantity}|${i.unit}`)
    .sort()
    .join(";");
}

/**
 * Design 7b "Your usuals": the confirmed meals a user logs most, newest first on ties.
 * Relogging one copies it without an AI call.
 */
export async function getUsuals(userId: string, limit = 6) {
  const meals = await prisma.mealLog.findMany({
    where: {
      userId,
      status: "CONFIRMED",
      createdAt: { gte: new Date(Date.now() - 60 * DAY) },
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const groups = new Map<string, { meal: (typeof meals)[number]; count: number }>();
  for (const m of meals) {
    if (!m.items.length) continue;
    const key = signature(m.items);
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { meal: m, count: 1 });
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count || +b.meal.createdAt - +a.meal.createdAt)
    .slice(0, limit)
    .map(({ meal, count }) => ({
      mealId: meal.id,
      mealType: meal.mealType,
      count,
      names: meal.items.map((i) => i.name),
      kcal: Math.round(meal.totalKcal),
      proteinG: Math.round(meal.totalProtein),
    }));
}

/** Copy a past confirmed meal into today as a new confirmed meal. No AI, no scan used. */
export async function relogMeal(userId: string, sourceMealId: string, mealType: MealType) {
  const source = await prisma.mealLog.findFirst({
    where: { id: sourceMealId, userId, status: "CONFIRMED" },
    include: { items: true },
  });
  if (!source) return null;
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });

  return prisma.mealLog.create({
    data: {
      userId,
      date: localDate(profile?.timezone),
      mealType,
      source: "TEXT",
      status: "CONFIRMED",
      confirmedAt: new Date(),
      note: source.note,
      totalKcal: source.totalKcal,
      totalProtein: source.totalProtein,
      totalCarbs: source.totalCarbs,
      totalFat: source.totalFat,
      items: {
        create: source.items.map((i) => ({
          foodId: i.foodId,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          grams: i.grams,
          kcal: i.kcal,
          proteinG: i.proteinG,
          carbsG: i.carbsG,
          fatG: i.fatG,
          approximate: i.approximate,
          isLiquid: i.isLiquid,
        })),
      },
    },
  });
}
