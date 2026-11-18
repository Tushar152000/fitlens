import { Injectable, Logger } from "@nestjs/common";
import type { FoodSource } from "@fitr8/db";
import { normalizeBarcode } from "@fitr8/domain/barcode";
import { labelAddsUp } from "@fitr8/domain/label";
import { AppError } from "../../common/errors.js";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import {
  barcodeSources,
  mapOff,
  type BarcodeSource,
  type ProductDraft,
  type ProductMeta,
  type SourceAnswer,
  type SourceName,
} from "./barcode-sources.js";

export type { ProductDraft } from "./barcode-sources.js";

const MISS_TTL_MS = 24 * 60 * 60 * 1000;

/** Kept for callers and tests: Open Food Facts product → full draft, or null without nutrition. */
export const mapOffProduct = (p: Record<string, unknown>): ProductDraft | null => mapOff(p).draft;

export type BarcodeResult =
  | { status: "invalid" }
  | { status: "not_found"; code: string; product?: ProductMeta }
  | { status: "found"; code: string; foodId: string };

const FOOD_SOURCE: Record<Exclude<SourceName, "UPCITEMDB">, FoodSource> = {
  OPEN_FOOD_FACTS: "OPEN_FOOD_FACTS",
  USDA: "USDA",
  FATSECRET: "FATSECRET",
  EDAMAM: "EDAMAM",
};

/**
 * Packaged foods by barcode: our database first, then every configured outside source
 * (barcode-sources.ts) at once. Never uses a photo scan.
 */
@Injectable()
export class BarcodeService {
  private readonly logger = new Logger(BarcodeService.name);
  private readonly sources: BarcodeSource[];

  constructor(
    private readonly prisma: PrismaService,
    @InjectEnv() env: Env,
  ) {
    this.sources = barcodeSources(env);
  }

  /**
   * GET /foods/barcode/:code — 400 for a malformed code, 404 for an unknown product. The 404 carries
   * the code and, when a source knew the product without its nutrition, its name/brand/photo so
   * the app can prefill the label scan.
   */
  async product(raw: string, userId: string) {
    const result = await this.lookup(raw, userId);
    if (result.status === "invalid") throw new AppError(400, "That isn't a valid barcode");
    if (result.status === "not_found")
      throw new AppError(404, "We don't know this product yet", {
        code: result.code,
        ...result.product,
      });
    return {
      code: result.code,
      food: await this.prisma.food.findUnique({ where: { id: result.foodId } }),
    };
  }

  /**
   * Design 7c/7d. Order: our foods (a label scan someone else saved is shared once its numbers add
   * up) → the 24 h miss cache → all outside sources in parallel, the most trusted full answer
   * winning. Every hit is saved, so each source sees each product once.
   */
  async lookup(raw: string, userId: string): Promise<BarcodeResult> {
    const code = normalizeBarcode(raw);
    if (!code) return { status: "invalid" };
    const candidates = code.length === 12 ? [code, `0${code}`] : [code];

    const existing = await this.prisma.food.findFirst({ where: { barcode: { in: candidates } } });
    if (existing) {
      if (existing.verified || existing.submittedById === userId) {
        return { status: "found", code, foodId: existing.id };
      }
      // An older label scan, saved before scans that check out were shared automatically.
      const checksOut = labelAddsUp({
        kcal: existing.kcalPer100g,
        protein: existing.proteinPer100g,
        carbs: existing.carbsPer100g,
        fat: existing.fatPer100g,
      }).ok;
      if (existing.source === "LABEL_SCAN" && checksOut) {
        await this.prisma.food.update({ where: { id: existing.id }, data: { verified: true } });
        return { status: "found", code, foodId: existing.id };
      }
      return { status: "not_found", code };
    }

    const miss = await this.prisma.barcodeMiss.findUnique({ where: { code } });
    if (miss && Date.now() - miss.checkedAt.getTime() < MISS_TTL_MS) {
      return { status: "not_found", code, product: miss.name ? metaOf(miss) : undefined };
    }

    const settled = await Promise.allSettled(this.sources.map((s) => s.lookup(candidates)));
    const answers: { source: SourceName; answer: SourceAnswer }[] = [];
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") answers.push({ source: this.sources[i].name, answer: r.value });
      else this.logger.warn(`Barcode source ${this.sources[i].name} failed: ${String(r.reason)}`);
    });

    const full = answers.find((a) => a.answer.draft && a.source !== "UPCITEMDB");
    if (full?.answer.draft) {
      const food = await this.save(
        full.answer.draft,
        code,
        FOOD_SOURCE[full.source as keyof typeof FOOD_SOURCE],
      );
      await this.prisma.barcodeMiss.deleteMany({ where: { code } });
      return { status: "found", code, foodId: food.id };
    }

    const product = answers.find((a) => a.answer.meta)?.answer.meta ?? undefined;
    if (answers.length === 0) {
      // Nothing answered at all: an outage, not an unknown product. Don't remember it as a miss.
      throw new AppError(502, "The product database is busy. Try again in a minute.");
    }
    // Only remember the miss when every source answered; a source that was down may know it.
    if (answers.length === this.sources.length) {
      const data = {
        checkedAt: new Date(),
        name: product?.name ?? null,
        brand: product?.brand ?? null,
        imageUrl: product?.imageUrl ?? null,
      };
      await this.prisma.barcodeMiss.upsert({
        where: { code },
        create: { code, ...data },
        update: data,
      });
    }
    return { status: "not_found", code, product };
  }

  private save(draft: ProductDraft, code: string, source: FoodSource) {
    return this.uniqueName(draft, code).then((name) =>
      this.prisma.food.create({
        data: {
          name,
          source,
          verified: true,
          barcode: code,
          brand: draft.brand,
          servingSizeG: draft.servingSizeG,
          servingLabel: draft.servingLabel,
          imageUrl: draft.imageUrl,
          kcalPer100g: draft.kcalPer100g,
          proteinPer100g: draft.proteinPer100g,
          carbsPer100g: draft.carbsPer100g,
          fatPer100g: draft.fatPer100g,
          sugarPer100g: draft.sugarPer100g,
          sodiumMgPer100g: draft.sodiumMgPer100g,
          isLiquid: draft.isLiquid,
          isVeg: true,
          units: draft.servingSizeG
            ? { create: [{ unit: "serving", grams: draft.servingSizeG }] }
            : undefined,
        },
      }),
    );
  }

  /** Food names are unique; brand them, and add the barcode if two products still clash. */
  private async uniqueName(draft: ProductDraft, code: string) {
    const base =
      draft.brand && !draft.name.toLowerCase().includes(draft.brand.toLowerCase())
        ? `${draft.name} (${draft.brand})`
        : draft.name;
    const taken = await this.prisma.food.findUnique({
      where: { name: base },
      select: { id: true },
    });
    return taken ? `${base} · ${code}` : base;
  }
}

const metaOf = (m: {
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
}): ProductMeta => ({
  name: m.name ?? "",
  brand: m.brand,
  imageUrl: m.imageUrl,
});
