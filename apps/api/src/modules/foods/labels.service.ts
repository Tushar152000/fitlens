import { Inject, Injectable } from "@nestjs/common";
import type { LabelRead, LabelSaveInput, LabelScanInput } from "@fitr8/contracts";
import type { Prisma } from "@fitr8/db";
import { normalizeBarcode } from "@fitr8/domain/barcode";
import { AppError, notFound } from "../../common/errors.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { StorageService } from "../../infra/storage/storage.service.js";
import { FOOD_EXTRACTOR, type FoodExtractor } from "../ai/index.js";
import { MealItemsService } from "../meals/meal-items.service.js";
import { MealsService } from "../meals/meals.service.js";
import { BillingService } from "../billing/billing.service.js";
import { ScanQuotaService } from "../meals/scan-quota.service.js";

/** Nutrition-label photos → a LabelScan the user checks (7g) → their own unreviewed Food, logged to a meal. */
@Injectable()
export class LabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly quota: ScanQuotaService,
    private readonly billing: BillingService,
    private readonly items: MealItemsService,
    private readonly meals: MealsService,
    @Inject(FOOD_EXTRACTOR) private readonly extractor: FoodExtractor,
  ) {}

  /**
   * Design 7f: read a nutrition-label photo into a LabelScan. Uses 1 photo scan, unless the photo
   * isn't a label (then nothing counts and the user is asked to retake it).
   */
  async scan(userId: string, input: LabelScanInput) {
    if (!input.photoKey.startsWith(`meals/${userId}/`)) {
      throw new AppError(403, "Photo does not belong to you");
    }
    if (!(await this.billing.limits(userId)).labelScans) {
      throw new AppError(402, "Label scans are part of FITR8 Pro.", { reason: "pro_required" });
    }
    await this.quota.assertCanScanPhoto(userId);

    const started = Date.now();
    let read: LabelRead;
    try {
      const result = await this.extractor.readNutritionLabel({
        image: await this.storage.getImage(input.photoKey),
      });
      read = result.data;
      await this.prisma.aiCall.create({
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
      await this.prisma.aiCall.create({
        data: {
          userId,
          type: "LABEL_SCAN",
          provider: this.extractor.name,
          model: "unknown",
          latencyMs: Date.now() - started,
          success: false,
          error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        },
      });
      throw new AppError(502, "We couldn't read the label. Try again, or type it instead.");
    }

    if (!read.isLabel) {
      throw new AppError(422, "That doesn't look like a nutrition table. This didn't use a scan.");
    }

    const scan = await this.prisma.labelScan.create({
      data: {
        userId,
        photoKey: input.photoKey,
        barcode: input.barcode ? normalizeBarcode(input.barcode) : null,
        name: input.name?.trim() || read.productName?.trim() || null,
        extracted: read as unknown as Prisma.InputJsonValue,
      },
    });
    return { id: scan.id };
  }

  /** Design 7g data: the values the AI read from a label photo, for the user to check. */
  async get(userId: string, id: string) {
    const scan = await this.ownedScan(userId, id);
    const read = scan.extracted as unknown as LabelRead;
    return {
      id: scan.id,
      name: scan.name ?? read.productName ?? "",
      per100g: read.per100g,
      servingSizeG: read.servingSizeG ?? null,
      servingLabel: read.servingLabel ?? null,
    };
  }

  /**
   * Design 7g "Save and add": create the user's (unreviewed) Food from the checked values, linked
   * to the barcode, and log it to the meal. Visible to others only after review.
   */
  async save(userId: string, scanId: string, input: LabelSaveInput) {
    const scan = await this.ownedScan(userId, scanId);
    const extracted = scan.extracted as unknown as LabelRead;

    // Barcode is unique: skip linking if someone else's unreviewed scan already holds it.
    const barcodeFree =
      scan.barcode && !(await this.prisma.food.findUnique({ where: { barcode: scan.barcode } }));
    const name = input.name.trim();
    const nameTaken = await this.prisma.food.findUnique({ where: { name }, select: { id: true } });

    const food = await this.prisma.food.create({
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
    await this.prisma.labelScan.update({ where: { id: scan.id }, data: { foodId: food.id } });

    const item = await this.items.buildItem(
      {
        foodId: food.id,
        name: food.name,
        quantity: input.quantity,
        unit: input.unit,
        grams: input.grams,
      },
      { trustGrams: true },
    );
    const log = await this.meals.createConfirmed(userId, {
      mealType: input.mealType,
      source: "PHOTO",
      photoKey: scan.photoKey,
      items: [item],
    });
    return { id: log.id };
  }

  private async ownedScan(userId: string, id: string) {
    const scan = await this.prisma.labelScan.findFirst({ where: { id, userId } });
    if (!scan) throw notFound("Label scan");
    return scan;
  }
}
