import { Injectable } from "@nestjs/common";
import { normalizeBarcode } from "@fitlens/domain/barcode";
import { AppError } from "../../common/errors.js";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";

const MISS_TTL_MS = 24 * 60 * 60 * 1000;
const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "brands",
  "serving_size",
  "serving_quantity",
  "image_front_small_url",
  "image_front_url",
  "nutriments",
].join(",");

export interface ProductDraft {
  name: string;
  brand: string | null;
  servingSizeG: number | null;
  servingLabel: string | null;
  imageUrl: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  sugarPer100g: number | null;
  sodiumMgPer100g: number | null;
  isLiquid: boolean;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Open Food Facts v3 `product` → our per-100 g fields. Null when it has no usable nutrition. */
export function mapOffProduct(p: Record<string, unknown>): ProductDraft | null {
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const kcal =
    num(n["energy-kcal_100g"]) ??
    (num(n["energy_100g"]) != null ? num(n["energy_100g"])! / 4.184 : null);
  const protein = num(n["proteins_100g"]);
  const carbs = num(n["carbohydrates_100g"]);
  const fat = num(n["fat_100g"]);
  if (kcal == null || protein == null || carbs == null || fat == null) return null;

  const name = String(p.product_name || p.product_name_en || "").trim();
  if (!name) return null;
  const serving = num(p.serving_quantity);
  const servingLabel = typeof p.serving_size === "string" ? p.serving_size.trim() : null;
  const sodium = num(n["sodium_100g"]);
  return {
    name,
    brand: typeof p.brands === "string" ? p.brands.split(",")[0].trim() || null : null,
    servingSizeG: serving && serving > 0 ? serving : null,
    servingLabel: servingLabel || null,
    imageUrl: (p.image_front_small_url || p.image_front_url || null) as string | null,
    kcalPer100g: r1(kcal),
    proteinPer100g: r1(protein),
    carbsPer100g: r1(carbs),
    fatPer100g: r1(fat),
    sugarPer100g: num(n["sugars_100g"]) != null ? r1(num(n["sugars_100g"])!) : null,
    sodiumMgPer100g: sodium != null ? Math.round(sodium * 1000) : null,
    isLiquid: Boolean(servingLabel && /\bml\b/i.test(servingLabel)),
  };
}

export type BarcodeResult =
  | { status: "invalid" }
  | { status: "not_found"; code: string }
  | { status: "found"; code: string; foodId: string };

/** Packaged foods by barcode: our database first, Open Food Facts behind it. Never uses a photo scan. */
@Injectable()
export class BarcodeService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectEnv() private readonly env: Env,
  ) {}

  /** GET /foods/barcode/:code — 400 for a malformed code, 404 (with the code) for an unknown product. */
  async product(raw: string, userId: string) {
    const result = await this.lookup(raw, userId);
    if (result.status === "invalid") throw new AppError(400, "That isn't a valid barcode");
    if (result.status === "not_found")
      throw new AppError(404, "We don't know this product yet", { code: result.code });
    return {
      code: result.code,
      food: await this.prisma.food.findUnique({ where: { id: result.foodId } }),
    };
  }

  /**
   * Design 7c/7d: our foods first (including label scans this user submitted), then the 24 h miss
   * cache, then Open Food Facts. Every hit is saved, so OFF sees each product once.
   */
  async lookup(raw: string, userId: string): Promise<BarcodeResult> {
    const code = normalizeBarcode(raw);
    if (!code) return { status: "invalid" };
    const candidates = code.length === 12 ? [code, `0${code}`] : [code];

    const existing = await this.prisma.food.findFirst({ where: { barcode: { in: candidates } } });
    if (existing) {
      const visible = existing.verified || existing.submittedById === userId;
      return visible
        ? { status: "found", code, foodId: existing.id }
        : { status: "not_found", code };
    }

    const miss = await this.prisma.barcodeMiss.findUnique({ where: { code } });
    if (miss && Date.now() - miss.checkedAt.getTime() < MISS_TTL_MS)
      return { status: "not_found", code };

    let product: Record<string, unknown> | null = null;
    for (const c of candidates) {
      product = await this.fetchOff(c);
      if (product) break;
    }
    const draft = product ? mapOffProduct(product) : null;
    if (!draft) {
      await this.prisma.barcodeMiss.upsert({
        where: { code },
        create: { code },
        update: { checkedAt: new Date() },
      });
      return { status: "not_found", code };
    }

    const food = await this.prisma.food.create({
      data: {
        name: await this.uniqueName(draft, code),
        source: "OPEN_FOOD_FACTS",
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
    });
    await this.prisma.barcodeMiss.deleteMany({ where: { code } });
    return { status: "found", code, foodId: food.id };
  }

  private async fetchOff(code: string): Promise<Record<string, unknown> | null> {
    const ua = `FitLens/0.1 (${this.env.OFF_CONTACT || "https://github.com/Tushar152000/fitlens"})`;
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v3/product/${code}?fields=${OFF_FIELDS}`,
      {
        headers: { "User-Agent": ua, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new AppError(502, "The product database is busy. Try again in a minute.");
    const body = (await res.json()) as { product?: Record<string, unknown> };
    return body.product ?? null;
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
