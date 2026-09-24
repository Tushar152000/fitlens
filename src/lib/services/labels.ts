import { ai, type LabelRead } from "@/lib/ai";
import { normalizeBarcode } from "@/lib/barcode";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http-error";
import type { MealType } from "@/lib/format";
import { sumMacros } from "@/lib/nutrition";
import { presignRead } from "@/lib/storage/s3";
import { assertCanScanPhoto, buildItem } from "./meals";

/**
 * Design 7f: read a nutrition-label photo into a LabelScan. Uses 1 photo scan, unless the photo
 * isn't a label (then nothing counts and the user is asked to retake it).
 */
export async function scanLabel(
  userId: string,
  input: { photoKey: string; barcode?: string; name?: string },
) {
  if (!input.photoKey.startsWith(`meals/${userId}/`)) {
    throw new HttpError(403, "Photo does not belong to you");
  }
  await assertCanScanPhoto(userId);

  const provider = ai();
  const started = Date.now();
  let read: LabelRead;
  try {
    const result = await provider.readNutritionLabel({
      imageUrl: await presignRead(input.photoKey),
    });
    read = result.data;
    await prisma.aiCall.create({
      data: {
        userId,
        type: "LABEL_SCAN",
        provider: result.usage.provider,
        model: result.usage.model,
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
        latencyMs: result.usage.latencyMs,
        success: true,
        countsAsScan: read.isLabel,
      },
    });
  } catch (err) {
    await prisma.aiCall.create({
      data: {
        userId,
        type: "LABEL_SCAN",
        provider: provider.name,
        model: "unknown",
        latencyMs: Date.now() - started,
        success: false,
        error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
      },
    });
    throw new HttpError(502, "We couldn't read the label. Try again, or type it instead.");
  }

  if (!read.isLabel) {
    throw new HttpError(422, "That doesn't look like a nutrition table. This didn't use a scan.");
  }

  const scan = await prisma.labelScan.create({
    data: {
      userId,
      photoKey: input.photoKey,
      barcode: input.barcode ? normalizeBarcode(input.barcode) : null,
      name: input.name?.trim() || read.productName?.trim() || null,
      extracted: read as unknown as object,
    },
  });
  return scan;
}

export function getLabelScan(userId: string, id: string) {
  return prisma.labelScan.findFirst({ where: { id, userId } });
}

/**
 * Design 7g "Save and add": create the user's (unreviewed) Food from the checked values, linked
 * to the barcode, and log it to the meal. Visible to others only after review.
 */
export async function saveLabelFood(
  userId: string,
  scanId: string,
  input: {
    name: string;
    per100g: { kcal: number; protein: number; carbs: number; fat: number };
    servingSizeG?: number;
    servingLabel?: string;
    quantity: number;
    unit: string;
    grams: number;
    mealType: MealType;
    isLiquid: boolean;
  },
) {
  const scan = await getLabelScan(userId, scanId);
  if (!scan) throw new HttpError(404, "Label scan not found");
  const extracted = scan.extracted as unknown as LabelRead;

  // Barcode is unique: skip linking if someone else's unreviewed scan already holds it.
  const barcodeFree =
    scan.barcode && !(await prisma.food.findUnique({ where: { barcode: scan.barcode } }));
  const name = input.name.trim();
  const nameTaken = await prisma.food.findUnique({ where: { name }, select: { id: true } });

  const food = await prisma.food.create({
    data: {
      name: nameTaken ? `${name} · ${scan.barcode ?? scan.id.slice(-6)}` : name,
      source: "LABEL_SCAN",
      verified: false,
      submittedById: userId,
      barcode: barcodeFree ? scan.barcode : null,
      kcalPer100g: input.per100g.kcal,
      proteinPer100g: input.per100g.protein,
      carbsPer100g: input.per100g.carbs,
      fatPer100g: input.per100g.fat,
      sugarPer100g: extracted.per100g.sugar ?? null,
      sodiumMgPer100g: extracted.per100g.sodiumMg ?? null,
      servingSizeG: input.servingSizeG ?? null,
      servingLabel: input.servingLabel ?? null,
      isLiquid: input.isLiquid,
      units: input.servingSizeG
        ? { create: [{ unit: "serving", grams: input.servingSizeG }] }
        : undefined,
    },
  });
  await prisma.labelScan.update({ where: { id: scan.id }, data: { foodId: food.id } });

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
  return prisma.mealLog.create({
    data: {
      userId,
      date: localDate(profile?.timezone),
      mealType: input.mealType,
      source: "PHOTO",
      photoKey: scan.photoKey,
      status: "CONFIRMED",
      confirmedAt: new Date(),
      totalKcal: totals.kcal,
      totalProtein: totals.proteinG,
      totalCarbs: totals.carbsG,
      totalFat: totals.fatG,
      items: { create: [item] },
    },
  });
}
