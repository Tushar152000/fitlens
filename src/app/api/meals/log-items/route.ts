import { NextResponse } from "next/server";
import { HttpError, parseBody, requireUserId, route } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { sumMacros } from "@/lib/nutrition";
import { buildItem } from "@/lib/services/meals";
import { LogItemsSchema } from "@/lib/validators";

/** Log known foods as one confirmed meal (e.g. the pre-workout snack). No AI, no scan used. */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const { mealType, items } = await parseBody(req, LogItemsSchema);
  const foods = await prisma.food.findMany({ where: { id: { in: items.map((i) => i.foodId) } } });
  if (foods.length !== new Set(items.map((i) => i.foodId)).size)
    throw new HttpError(404, "Food not found");
  const byId = new Map(foods.map((f) => [f.id, f]));
  const built = await Promise.all(
    items.map((i) => buildItem({ ...i, name: byId.get(i.foodId)!.name }, { trustGrams: true })),
  );
  const totals = sumMacros(built);
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const log = await prisma.mealLog.create({
    data: {
      userId,
      date: localDate(profile?.timezone),
      mealType,
      source: "TEXT",
      status: "CONFIRMED",
      confirmedAt: new Date(),
      totalKcal: totals.kcal,
      totalProtein: totals.proteinG,
      totalCarbs: totals.carbsG,
      totalFat: totals.fatG,
      items: { create: built },
    },
  });
  return NextResponse.json({ id: log.id }, { status: 201 });
});
