import { ai, type DetectedItem, type MealContext } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http-error";
import { startOfLocalDay } from "@/lib/dates";
import { env } from "@/lib/env";
import { scaleNutrition, sumMacros } from "@/lib/nutrition";
import { presignRead } from "@/lib/storage/s3";
import type { Prisma } from "@/generated/prisma/client";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Units with a standard weight; everything else (cup, glass, bowl, katori…) varies by vessel. */
const FIXED_UNITS = new Set(["piece", "sachet", "tsp", "tbsp", "cube", "scoop", "shot", "can"]);

/** AI matching never uses someone's unreviewed label scan. */
const PUBLIC_FOOD = { OR: [{ verified: true }, { source: { not: "LABEL_SCAN" as const } }] };

/** Exact name/alias match first, then a contains match. Embedding search can replace this later. */
export async function matchFood(name: string) {
  const n = normalize(name);
  return (
    (await prisma.food.findFirst({
      where: {
        OR: [{ name: { equals: n, mode: "insensitive" } }, { aliases: { has: n } }],
        AND: [PUBLIC_FOOD],
      },
      include: { units: true },
    })) ??
    (await prisma.food.findFirst({
      where: { name: { contains: n, mode: "insensitive" }, AND: [PUBLIC_FOOD] },
      include: { units: true },
    }))
  );
}

/**
 * Build a meal item with nutrition from our database (or the given estimate, flagged approximate).
 * `trustGrams` keeps the caller's grams instead of recomputing from the unit: `true` for every unit
 * (a user-set amount), `"containers"` only for units whose size varies (cup, glass, bowl…), so a
 * sachet or teaspoon keeps its standard weight.
 */
export async function buildItem(
  input: {
    name: string;
    quantity: number;
    unit: string;
    grams: number;
    foodId?: string;
    per100g?: DetectedItem["per100g"];
    isLiquid?: boolean;
  },
  { trustGrams = false }: { trustGrams?: boolean | "containers" } = {},
) {
  const food = input.foodId
    ? await prisma.food.findUnique({ where: { id: input.foodId }, include: { units: true } })
    : await matchFood(input.name);

  const unitGrams = food?.units.find((u) => u.unit === normalize(input.unit))?.grams;
  const unit = normalize(input.unit);
  const keepGiven = trustGrams === true || (trustGrams === "containers" && !FIXED_UNITS.has(unit));
  const grams = unitGrams && !keepGiven ? unitGrams * input.quantity : input.grams;

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
    isLiquid: food?.isLiquid ?? input.isLiquid ?? false,
  };
}

/** Typed meals are free; this only stops runaway use. Not shown to users. */
const TEXT_DAILY_CAP = 60;

async function userDayStart(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const tz = profile?.timezone ?? "Asia/Kolkata";
  const since = startOfLocalDay(tz);
  // 26 h later is always inside the next local day, even across a DST change.
  const resetsAt = startOfLocalDay(tz, new Date(since.getTime() + 26 * 60 * 60 * 1000));
  return { since, resetsAt };
}

/**
 * Photo scans used today (local day). Only successful photo/label reads of real food count:
 * typed meals, "usuals", not-food results and our own failures never do.
 */
export async function scanUsage(userId: string) {
  const { since, resetsAt } = await userDayStart(userId);
  const used = await prisma.aiCall.count({
    where: { userId, countsAsScan: true, createdAt: { gte: since } },
  });
  const limit = env().AI_DAILY_LIMIT;
  return { used, limit, left: Math.max(0, limit - used), resetsAt: resetsAt.toISOString() };
}

export type ScanUsage = Awaited<ReturnType<typeof scanUsage>>;

/** Throws 429 with the usage in `details` (for the 9c sheet) when no photo scans are left. */
export async function assertCanScanPhoto(userId: string) {
  const usage = await scanUsage(userId);
  if (usage.left <= 0) {
    throw new HttpError(429, `You've used today's ${usage.limit} free photo scans.`, usage);
  }
  return usage;
}

export async function assertWithinTextCap(userId: string) {
  const { since } = await userDayStart(userId);
  const count = await prisma.aiCall.count({
    where: { userId, type: "MEAL_TEXT", createdAt: { gte: since } },
  });
  if (count >= TEXT_DAILY_CAP) {
    throw new HttpError(429, "That's a lot of typed meals for one day. Try again tomorrow.");
  }
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
    userNote: log.note ?? undefined,
  };

  const provider = ai();
  const started = Date.now();
  try {
    const result =
      log.source === "PHOTO"
        ? await provider.analyzeMealPhoto({ imageUrl: await presignRead(log.photoKey!), context })
        : await provider.parseMealText({ text: log.inputText ?? log.note ?? "", context });

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
        // A not-food photo doesn't use up a scan (design 9b).
        countsAsScan: log.source === "PHOTO" && result.data.isFood,
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
        // When the user wrote details ("small 120 ml cup"), keep the model's amounts over standard unit sizes.
        ...(await buildItem(
          { ...d, isLiquid: d.isDrink },
          { trustGrams: log.note ? "containers" : false },
        )),
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
    per100g?: DetectedItem["per100g"];
    isLiquid?: boolean;
  }[],
  note?: string | null,
) {
  const existing = await prisma.mealItem.findMany({ where: { mealLogId } });
  const byId = new Map(existing.map((e) => [e.id, e]));

  const items = await Promise.all(
    input.map(async (i) => {
      const prev = i.id ? byId.get(i.id) : undefined;
      // Keep the user's amount; estimated items keep their own nutrition (no food row to price from).
      const built = await buildItem(i, { trustGrams: true });
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
        ...(note !== undefined ? { note: note || null } : {}),
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

/**
 * Turn a short description ("2 sachets sugar") into priced items for an existing meal, without
 * creating a meal log. Counts toward the daily AI limit like any other call.
 */
export async function parseExtraItems(
  userId: string,
  text: string,
  mealType: MealContext["mealType"],
) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { dietType: true },
  });
  const provider = ai();
  const started = Date.now();
  try {
    const result = await provider.parseMealText({
      text,
      context: { mealType, dietType: profile?.dietType ?? "VEG" },
    });
    await prisma.aiCall.create({
      data: {
        userId,
        type: "MEAL_TEXT",
        provider: result.usage.provider,
        model: result.usage.model,
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
        latencyMs: result.usage.latencyMs,
        success: true,
      },
    });
    if (!result.data.isFood) return [];
    return Promise.all(
      result.data.items.map(async (d) => ({
        ...(await buildItem({ ...d, isLiquid: d.isDrink })),
        aiConfidence: d.confidence,
      })),
    );
  } catch (err) {
    await prisma.aiCall.create({
      data: {
        userId,
        type: "MEAL_TEXT",
        provider: provider.name,
        model: "unknown",
        latencyMs: Date.now() - started,
        success: false,
        error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
      },
    });
    throw err;
  }
}
