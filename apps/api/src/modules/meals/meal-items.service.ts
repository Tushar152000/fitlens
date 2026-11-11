import { Injectable } from "@nestjs/common";
import type { DetectedItem } from "@fitr8/contracts";
import { scaleNutrition } from "@fitr8/domain/nutrition";
import { PrismaService } from "../../infra/prisma/prisma.service.js";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Units with a standard weight; everything else (cup, glass, bowl, katori…) varies by vessel. */
const FIXED_UNITS = new Set(["piece", "sachet", "tsp", "tbsp", "cube", "scoop", "shot", "can"]);

/**
 * Foods the AI's item names may match: generic foods only. Never someone's unreviewed label scan, and
 * no branded barcode products (those are reached by scanning or search, not by a name like "biscuit").
 */
const AI_MATCHABLE = {
  barcode: null,
  OR: [{ verified: true }, { source: { not: "LABEL_SCAN" as const } }],
};

interface Candidate {
  name: string;
  aliases: string[];
}

/** Word suffixes of a name, longest first: "plain white rice" → ["plain white rice", "white rice", "rice"]. */
function wordSuffixes(n: string): string[] {
  const words = n.split(" ");
  return words.map((_, i) => words.slice(i).join(" "));
}

/**
 * Pick the database food for a detected name, or null when the match would be a guess. In order:
 * 1. exact name or alias;
 * 2. the longest food name that ends the detected name ("tandoori roti" → "roti", "plain white rice" →
 *    "white rice") — a qualifier in front keeps the dish; a food at the start ("ghee rice") is not a match;
 * 3. the one food whose name ends with the detected name ("chai" → "masala chai"), only if unambiguous —
 *    "coffee" against black coffee, latte and cold coffee is a guess, so the model's estimate is used.
 */
export function pickFood<T extends Candidate>(detected: string, candidates: T[]): T | null {
  const n = normalize(detected);
  if (!n) return null;
  const named = candidates.map((c) => ({ c, name: normalize(c.name) }));

  const exact = named.find(
    ({ c, name }) => name === n || c.aliases.some((a) => normalize(a) === n),
  );
  if (exact) return exact.c;

  const suffixes = new Set(wordSuffixes(n));
  const head = named
    .filter(({ name }) => suffixes.has(name))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (head) return head.c;

  const specific = named.filter(({ name }) => name.endsWith(` ${n}`));
  return specific.length === 1 ? specific[0]!.c : null;
}

export interface ItemInput {
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  foodId?: string;
  per100g?: DetectedItem["per100g"];
  isLiquid?: boolean;
}

export type BuiltItem = Awaited<ReturnType<MealItemsService["buildItem"]>>;

/** Prices meal items from the food database (read-only), falling back to the model's estimate. */
@Injectable()
export class MealItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /** One query for every plausible candidate, then a deterministic pick (see `pickFood`). */
  async matchFood(name: string) {
    const n = normalize(name);
    if (!n) return null;
    const candidates = await this.prisma.food.findMany({
      where: {
        AND: [AI_MATCHABLE],
        OR: [
          { name: { in: wordSuffixes(n), mode: "insensitive" } },
          { aliases: { has: n } },
          { name: { endsWith: ` ${n}`, mode: "insensitive" } },
        ],
      },
      include: { units: true },
      take: 25,
    });
    return pickFood(n, candidates);
  }

  /**
   * Build a meal item with nutrition from our database (or the given estimate, flagged approximate).
   * `trustGrams` keeps the caller's grams instead of recomputing from the unit: `true` for every unit
   * (a user-set amount), `"containers"` only for units whose size varies (cup, glass, bowl…), so a
   * sachet or teaspoon keeps its standard weight.
   */
  async buildItem(
    input: ItemInput,
    { trustGrams = false }: { trustGrams?: boolean | "containers" } = {},
  ) {
    const food = input.foodId
      ? await this.prisma.food.findUnique({ where: { id: input.foodId }, include: { units: true } })
      : await this.matchFood(input.name);

    const unitGrams = food?.units.find((u) => u.unit === normalize(input.unit))?.grams;
    const unit = normalize(input.unit);
    const keepGiven =
      trustGrams === true || (trustGrams === "containers" && !FIXED_UNITS.has(unit));
    const grams = unitGrams && !keepGiven ? unitGrams * input.quantity : input.grams;

    const per100g = food
      ? {
          kcal: food.kcalPer100g,
          protein: food.proteinPer100g,
          carbs: food.carbsPer100g,
          fat: food.fatPer100g,
        }
      : input.per100g;

    const n = per100g
      ? scaleNutrition(per100g, grams)
      : { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

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
}
