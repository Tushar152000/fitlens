import { ai, type DetectedItem, type MealContext } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { scaleNutrition, sumMacros } from "@/lib/nutrition";
import { presignRead } from "@/lib/storage/s3";
import type { Prisma } from "@/generated/prisma/client";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Exact name/alias match first, then a contains match. Embedding search can replace this later. */
export async function matchFood(name: string) {
  const n = normalize(name);
  return (
    (await prisma.food.findFirst({
      where: { OR: [{ name: { equals: n, mode: "insensitive" } }, { aliases: { has: n } }] },
      include: { units: true },
    })) ??
    (await prisma.food.findFirst({
      where: { name: { contains: n, mode: "insensitive" } },
      include: { units: true },
    }))
  );
}

/** Build a meal item with nutrition from our database (or the AI's estimate, flagged approximate). */
export async function buildItem(input: {
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  foodId?: string;
  per100g?: DetectedItem["per100g"];
}) {
  const food = input.foodId
    ? await prisma.food.findUnique({ where: { id: input.foodId }, include: { units: true } })
    : await matchFood(input.name);

  const unitGrams = food?.units.find((u) => u.unit === normalize(input.unit))?.grams;
  const grams = unitGrams ? unitGrams * input.quantity : input.grams;

  const per100g = food
    ? {
        kcal: food.kcalPer100g,
        protein: food.proteinPer100g,
        carbs: food.carbsPer100g,
        fat: food.fatPer100g,
      }
    : input.per100g;

  const n = per100g ? scaleNutrition(per100g, grams) : { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

  return {
    foodId: food?.id ?? null,
    name: food?.name ?? normalize(input.name),
    quantity: input.quantity,
    unit: normalize(input.unit),
    grams,
    ...n,
    approximate: !food,
  };
}

export async function assertWithinDailyAiLimit(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.aiCall.count({ where: { userId, createdAt: { gte: since } } });
  return count < env().AI_DAILY_LIMIT;
}

/** Runs the AI on a PENDING meal log and stores detected items. Safe to retry. */
export async function analyzeMealLog(mealLogId: string) {
  const log = await prisma.mealLog.findUnique({
    where: { id: mealLogId },
    include: { user: { include: { profile: true } } },
  });
  if (!log || log.status === "CONFIRMED") return;

  await prisma.mealLog.update({
    where: { id: log.id },
    data: { status: "ANALYZING", error: null },
  });

  const frequent = await prisma.mealItem.groupBy({
    by: ["name"],
    where: { mealLog: { userId: log.userId, status: "CONFIRMED" } },
    _count: { name: true },
    orderBy: { _count: { name: "desc" } },
    take: 20,
  });

  const context: MealContext = {
    mealType: log.mealType,
    dietType: log.user.profile?.dietType ?? "VEG",
    frequentFoods: frequent.map((f) => f.name),
  };

  const provider = ai();
  const started = Date.now();
  try {
    const result =
      log.source === "PHOTO"
        ? await provider.analyzeMealPhoto({ imageUrl: await presignRead(log.photoKey!), context })
        : await provider.parseMealText({ text: log.inputText!, context });

    await prisma.aiCall.create({
      data: {
        userId: log.userId,
        type: log.source === "PHOTO" ? "MEAL_PHOTO" : "MEAL_TEXT",
        provider: result.usage.provider,
        model: result.usage.model,
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
        latencyMs: result.usage.latencyMs,
        success: true,
      },
    });

    if (!result.data.isFood) {
      await prisma.mealLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          error: "That doesn't look like food. Try another photo.",
          aiRaw: result.data,
        },
      });
      return;
    }

    const items = await Promise.all(
      result.data.items.map(async (d) => ({
        ...(await buildItem(d)),
        aiConfidence: d.confidence,
        aiGrams: d.grams,
      })),
    );
    const totals = sumMacros(items);

    await prisma.$transaction([
      prisma.mealItem.deleteMany({ where: { mealLogId: log.id } }),
      prisma.mealItem.createMany({
        data: items.map((i) => ({ ...i, mealLogId: log.id })),
      }),
      prisma.mealLog.update({
        where: { id: log.id },
        data: {
          status: "READY",
          aiRaw: result.data as unknown as Prisma.InputJsonValue,
          aiNotes: result.data.hiddenFatLikely
            ? [result.data.notes, "Oil or ghee may have been added — adjust if needed."]
                .filter(Boolean)
                .join(" ")
            : result.data.notes,
          totalKcal: totals.kcal,
          totalProtein: totals.proteinG,
          totalCarbs: totals.carbsG,
          totalFat: totals.fatG,
        },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.aiCall.create({
      data: {
        userId: log.userId,
        type: log.source === "PHOTO" ? "MEAL_PHOTO" : "MEAL_TEXT",
        provider: provider.name,
        model: "unknown",
        latencyMs: Date.now() - started,
        success: false,
        error: message.slice(0, 500),
      },
    });
    await prisma.mealLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: "Analysis failed. You can retry or log by text." },
    });
    throw err;
  }
}

/** Replace the AI's items with the user's confirmed list and recompute totals. */
export async function confirmMeal(
  mealLogId: string,
  input: {
    id?: string;
    foodId?: string;
    name: string;
    quantity: number;
    unit: string;
    grams: number;
  }[],
) {
  const existing = await prisma.mealItem.findMany({ where: { mealLogId } });
  const byId = new Map(existing.map((e) => [e.id, e]));

  const items = await Promise.all(
    input.map(async (i) => {
      const prev = i.id ? byId.get(i.id) : undefined;
      const built = await buildItem(i);
      const edited =
        !prev ||
        prev.name !== built.name ||
        prev.quantity !== built.quantity ||
        prev.unit !== built.unit ||
        prev.grams !== built.grams;
      return {
        ...built,
        aiConfidence: prev?.aiConfidence ?? null,
        aiGrams: prev?.aiGrams ?? null,
        edited,
      };
    }),
  );
  const totals = sumMacros(items);

  const [, , log] = await prisma.$transaction([
    prisma.mealItem.deleteMany({ where: { mealLogId } }),
    prisma.mealItem.createMany({ data: items.map((i) => ({ ...i, mealLogId })) }),
    prisma.mealLog.update({
      where: { id: mealLogId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        totalKcal: totals.kcal,
        totalProtein: totals.proteinG,
        totalCarbs: totals.carbsG,
        totalFat: totals.fatG,
      },
      include: { items: true },
    }),
  ]);
  return log;
}
