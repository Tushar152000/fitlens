import type { Env } from "../../config/config.module.js";

/**
 * Outside product databases for barcodes, tried when a product isn't in our own database.
 *
 * Each source answers with a full product (nutrition per 100 g), only what it knows about the
 * product (name, brand, photo: enough to prefill a label scan), or nothing. A transport failure
 * throws, so the caller can tell "unknown product" from "source unreachable". Open Food Facts is
 * always on; the others switch on with their keys (env.ts, docs/DEPLOY.md "Barcode sources").
 */

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

/** What a source knows without (usable) nutrition. */
export interface ProductMeta {
  name: string;
  brand: string | null;
  imageUrl: string | null;
}

export interface SourceAnswer {
  draft: ProductDraft | null;
  meta: ProductMeta | null;
}

export type SourceName = "OPEN_FOOD_FACTS" | "USDA" | "FATSECRET" | "EDAMAM" | "UPCITEMDB";

export interface BarcodeSource {
  name: SourceName;
  /** Candidate codes, best first (a 12-digit UPC is also tried as EAN-13 with a leading 0). */
  lookup: (codes: string[]) => Promise<SourceAnswer>;
}

const TIMEOUT_MS = 8000;
const NONE: SourceAnswer = { draft: null, meta: null };

const num = (v: unknown) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const text = (v: unknown, max = 200) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
/** Same product, different padding: compare GTINs without leading zeros. */
export const sameGtin = (a: string, b: string) => a.replace(/^0+/, "") === b.replace(/^0+/, "");

function draftFrom(
  per100: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null },
  rest: Omit<ProductDraft, "kcalPer100g" | "proteinPer100g" | "carbsPer100g" | "fatPer100g">,
): ProductDraft | null {
  const { kcal, protein, carbs, fat } = per100;
  if (kcal == null || protein == null || carbs == null || fat == null) return null;
  if (!rest.name) return null;
  return {
    ...rest,
    kcalPer100g: r1(kcal),
    proteinPer100g: r1(protein),
    carbsPer100g: r1(carbs),
    fatPer100g: r1(fat),
  };
}

// ── Open Food Facts ─────────────────────────────────────────────────────────

export const OFF_FIELDS = [
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

/** Open Food Facts v3 `product` → our per-100 g fields (and what it knows when nutrition is missing). */
export function mapOff(p: Record<string, unknown>): SourceAnswer {
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const name = text(p.product_name) ?? text(p.product_name_en);
  if (!name) return NONE;
  const brand = typeof p.brands === "string" ? text(p.brands.split(",")[0], 120) : null;
  const imageUrl = text(p.image_front_small_url, 500) ?? text(p.image_front_url, 500);
  const kcal =
    num(n["energy-kcal_100g"]) ??
    (num(n["energy_100g"]) != null ? num(n["energy_100g"])! / 4.184 : null);
  const serving = num(p.serving_quantity);
  const servingLabel = text(p.serving_size, 60);
  const sodium = num(n["sodium_100g"]);
  const sugar = num(n["sugars_100g"]);
  const draft = draftFrom(
    {
      kcal,
      protein: num(n["proteins_100g"]),
      carbs: num(n["carbohydrates_100g"]),
      fat: num(n["fat_100g"]),
    },
    {
      name,
      brand,
      servingSizeG: serving && serving > 0 ? serving : null,
      servingLabel,
      imageUrl,
      sugarPer100g: sugar != null ? r1(sugar) : null,
      sodiumMgPer100g: sodium != null ? Math.round(sodium * 1000) : null,
      isLiquid: Boolean(servingLabel && /\bml\b/i.test(servingLabel)),
    },
  );
  return { draft, meta: { name, brand, imageUrl } };
}

function openFoodFacts(env: Env): BarcodeSource {
  const ua = `FITR8/0.1 (${env.OFF_CONTACT || "https://github.com/Tushar152000/fitr8"})`;
  return {
    name: "OPEN_FOOD_FACTS",
    async lookup(codes) {
      let best: SourceAnswer = NONE;
      for (const code of codes) {
        const res = await fetch(
          `https://world.openfoodfacts.org/api/v3/product/${code}?fields=${OFF_FIELDS}`,
          {
            headers: { "User-Agent": ua, Accept: "application/json" },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          },
        );
        if (res.status === 404) continue;
        if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);
        const body = (await res.json()) as { product?: Record<string, unknown> };
        const answer = body.product ? mapOff(body.product) : NONE;
        if (answer.draft) return answer;
        best = best.meta ? best : answer;
      }
      return best;
    },
  };
}

// ── USDA FoodData Central (branded foods) ───────────────────────────────────

interface FdcNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  value?: number;
}

/** A Branded food from FDC search (nutrient values are per 100 g / 100 ml). */
export function mapUsda(f: Record<string, unknown>): SourceAnswer {
  const name = text(f.description);
  if (!name) return NONE;
  const brand = text(f.brandName, 120) ?? text(f.brandOwner, 120);
  const nutrients = (f.foodNutrients ?? []) as FdcNutrient[];
  // FDC nutrient ids (and legacy numbers): energy kcal 1008/208, protein 1003/203, carbs 1005/205,
  // fat 1004/204, sugars 2000/269, sodium 1093/307 (mg).
  const pick = (id: number, nr: string) =>
    num(nutrients.find((n) => n.nutrientId === id || n.nutrientNumber === nr)?.value);
  const unit = typeof f.servingSizeUnit === "string" ? f.servingSizeUnit.toLowerCase() : "";
  const serving = num(f.servingSize);
  const servingInGrams =
    serving && (unit === "g" || unit === "grm" || unit === "ml" || unit === "mlt");
  const isLiquid = unit === "ml" || unit === "mlt";
  const sugar = pick(2000, "269");
  const sodium = pick(1093, "307");
  const draft = draftFrom(
    {
      kcal: pick(1008, "208"),
      protein: pick(1003, "203"),
      carbs: pick(1005, "205"),
      fat: pick(1004, "204"),
    },
    {
      name,
      brand,
      servingSizeG: servingInGrams ? serving : null,
      servingLabel: text(f.householdServingFullText, 60),
      imageUrl: null,
      sugarPer100g: sugar != null ? r1(sugar) : null,
      sodiumMgPer100g: sodium != null ? Math.round(sodium) : null,
      isLiquid,
    },
  );
  return { draft, meta: { name, brand, imageUrl: null } };
}

function usda(key: string): BarcodeSource {
  return {
    name: "USDA",
    async lookup(codes) {
      const res = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query: codes[0], dataType: ["Branded"], pageSize: 10 }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      if (!res.ok) throw new Error(`USDA ${res.status}`);
      const body = (await res.json()) as { foods?: Record<string, unknown>[] };
      // Search is full-text: only an exact GTIN match counts.
      const hit = (body.foods ?? []).find(
        (f) => typeof f.gtinUpc === "string" && codes.some((c) => sameGtin(f.gtinUpc as string, c)),
      );
      return hit ? mapUsda(hit) : NONE;
    },
  };
}

// ── FatSecret Platform (Premier: barcode scope) ─────────────────────────────

interface FsServing {
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  serving_description?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
  sugar?: string;
  sodium?: string;
}

/** FatSecret `food` (food.find_id_for_barcode v2): per-serving values scaled to 100 g/ml. */
export function mapFatSecret(food: Record<string, unknown>): SourceAnswer {
  const name = text(food.food_name);
  if (!name) return NONE;
  const brand = text(food.brand_name, 120);
  const raw = (food.servings as { serving?: FsServing | FsServing[] } | undefined)?.serving;
  const servings = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const metric = servings.find((s) => {
    const unit = (s.metric_serving_unit ?? "").toLowerCase();
    return (unit === "g" || unit === "ml") && (num(s.metric_serving_amount) ?? 0) > 0;
  });
  const meta = { name, brand, imageUrl: null };
  if (!metric) return { draft: null, meta };
  const amount = num(metric.metric_serving_amount)!;
  const per100 = (v: string | undefined) => {
    const n = num(v);
    return n == null ? null : (n * 100) / amount;
  };
  const sugar = per100(metric.sugar);
  const sodium = per100(metric.sodium);
  const draft = draftFrom(
    {
      kcal: per100(metric.calories),
      protein: per100(metric.protein),
      carbs: per100(metric.carbohydrate),
      fat: per100(metric.fat),
    },
    {
      name,
      brand,
      servingSizeG: amount,
      servingLabel: text(metric.serving_description, 60),
      imageUrl: null,
      sugarPer100g: sugar != null ? r1(sugar) : null,
      sodiumMgPer100g: sodium != null ? Math.round(sodium) : null,
      isLiquid: (metric.metric_serving_unit ?? "").toLowerCase() === "ml",
    },
  );
  return { draft, meta };
}

function fatSecret(id: string, secret: string): BarcodeSource {
  let token: { value: string; until: number } | null = null;
  async function accessToken() {
    if (token && token.until > Date.now()) return token.value;
    const res = await fetch("https://oauth.fatsecret.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials&scope=basic%20barcode",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`FatSecret token ${res.status}`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: body.access_token, until: Date.now() + (body.expires_in - 60) * 1000 };
    return token.value;
  }
  return {
    name: "FATSECRET",
    async lookup(codes) {
      // FatSecret wants GTIN-13: pad on the left.
      const gtin13 = codes[codes.length - 1].padStart(13, "0");
      const res = await fetch(
        `https://platform.fatsecret.com/rest/food/barcode/find-by-id/v2?barcode=${gtin13}&format=json`,
        {
          headers: { Authorization: `Bearer ${await accessToken()}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      if (!res.ok) throw new Error(`FatSecret ${res.status}`);
      const body = (await res.json()) as {
        food?: Record<string, unknown>;
        food_id?: { value?: string };
      };
      return body.food ? mapFatSecret(body.food) : NONE;
    },
  };
}

// ── Edamam Food Database ────────────────────────────────────────────────────

/** Edamam parser `hints[0].food` (nutrients per 100 g). */
export function mapEdamam(food: Record<string, unknown>): SourceAnswer {
  const name = text(food.label);
  if (!name) return NONE;
  const brand = text(food.brand, 120);
  const imageUrl = text(food.image, 500);
  const n = (food.nutrients ?? {}) as Record<string, unknown>;
  const draft = draftFrom(
    { kcal: num(n.ENERC_KCAL), protein: num(n.PROCNT), carbs: num(n.CHOCDF), fat: num(n.FAT) },
    {
      name,
      brand,
      servingSizeG: null,
      servingLabel: null,
      imageUrl,
      sugarPer100g: num(n.SUGAR) != null ? r1(num(n.SUGAR)!) : null,
      sodiumMgPer100g: num(n.NA) != null ? Math.round(num(n.NA)!) : null,
      isLiquid: false,
    },
  );
  return { draft, meta: { name, brand, imageUrl } };
}

function edamam(appId: string, appKey: string): BarcodeSource {
  return {
    name: "EDAMAM",
    async lookup(codes) {
      const url =
        `https://api.edamam.com/api/food-database/v2/parser?app_id=${encodeURIComponent(appId)}` +
        `&app_key=${encodeURIComponent(appKey)}&upc=${codes[0]}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status === 404) return NONE;
      if (!res.ok) throw new Error(`Edamam ${res.status}`);
      const body = (await res.json()) as { hints?: { food?: Record<string, unknown> }[] };
      const food = body.hints?.[0]?.food;
      return food ? mapEdamam(food) : NONE;
    },
  };
}

// ── UPCitemdb (names only) ──────────────────────────────────────────────────

/** UPCitemdb `items[0]`: no nutrition, but a name/brand/photo to prefill the label scan. */
export function mapUpcItemDb(item: Record<string, unknown>): SourceAnswer {
  const name = text(item.title);
  if (!name) return NONE;
  const images = Array.isArray(item.images) ? (item.images as unknown[]) : [];
  return {
    draft: null,
    meta: { name, brand: text(item.brand, 120), imageUrl: text(images[0], 500) },
  };
}

function upcItemDb(): BarcodeSource {
  return {
    name: "UPCITEMDB",
    async lookup(codes) {
      const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${codes[0]}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // Unknown codes come back 200 with no items; 400 INVALID_UPC is "not a code it accepts".
      if (res.status === 404 || res.status === 400) return NONE;
      if (!res.ok) throw new Error(`UPCitemdb ${res.status}`); // 429 = daily trial quota used
      const body = (await res.json()) as { items?: Record<string, unknown>[] };
      return body.items?.[0] ? mapUpcItemDb(body.items[0]) : NONE;
    },
  };
}

/** The sources this deployment can use, in order of trust (first full answer wins). */
export function barcodeSources(env: Env): BarcodeSource[] {
  return [
    openFoodFacts(env),
    env.FATSECRET_CLIENT_ID && env.FATSECRET_CLIENT_SECRET
      ? fatSecret(env.FATSECRET_CLIENT_ID, env.FATSECRET_CLIENT_SECRET)
      : null,
    env.USDA_FDC_API_KEY ? usda(env.USDA_FDC_API_KEY) : null,
    env.EDAMAM_APP_ID && env.EDAMAM_APP_KEY ? edamam(env.EDAMAM_APP_ID, env.EDAMAM_APP_KEY) : null,
    env.UPCITEMDB_ENABLED ? upcItemDb() : null,
  ].filter((s): s is BarcodeSource => s !== null);
}
