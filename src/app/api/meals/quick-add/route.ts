import { NextResponse } from "next/server";
import { HttpError, parseBody, requireUserId, route } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { sumMacros } from "@/lib/nutrition";
import { buildItem } from "@/lib/services/meals";
import { QuickAddSchema } from "@/lib/validators";

/** Log one known food straight to a meal (barcode product "Add to snack"). No AI, no scan used. */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const input = await parseBody(req, QuickAddSchema);
  const food = await prisma.food.findUnique({ where: { id: input.foodId } });
  if (!food || (food.source === "LABEL_SCAN" && !food.verified && food.submittedById !== userId)) {
    throw new HttpError(404, "Food not found");
  }
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const item = await buildItem(
    {
      foodId: food.id,
      name: food.name,
      quantity: input.quantity,
      unit: input.unit,
      grams: input.grams,
    },
    { trustGrams: true },
  );
  const totals = sumMacros([item]);
  const log = await prisma.mealLog.create({
    data: {
      userId,
      date: localDate(profile?.timezone),
      mealType: input.mealType,
      source: "TEXT",
      status: "CONFIRMED",
      confirmedAt: new Date(),
      totalKcal: totals.kcal,
      totalProtein: totals.proteinG,
      totalCarbs: totals.carbsG,
      totalFat: totals.fatG,
      items: { create: [item] },
    },
  });
  return NextResponse.json({ id: log.id }, { status: 201 });
});
