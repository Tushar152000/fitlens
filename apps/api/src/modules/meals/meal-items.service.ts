import { Injectable } from "@nestjs/common";
import type { DetectedItem } from "@fitlens/contracts";
import { scaleNutrition } from "@fitlens/domain/nutrition";
import { PrismaService } from "../../infra/prisma/prisma.service.js";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Units with a standard weight; everything else (cup, glass, bowl, katori…) varies by vessel. */
const FIXED_UNITS = new Set(["piece", "sachet", "tsp", "tbsp", "cube", "scoop", "shot", "can"]);

/** AI matching never uses someone's unreviewed label scan. */
const PUBLIC_FOOD = { OR: [{ verified: true }, { source: { not: "LABEL_SCAN" as const } }] };

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

  /** Exact name/alias match first, then a contains match. Embedding search can replace this later. */
  async matchFood(name: string) {
    const n = normalize(name);
    return (
      (await this.prisma.food.findFirst({
        where: {
          OR: [{ name: { equals: n, mode: "insensitive" } }, { aliases: { has: n } }],
          AND: [PUBLIC_FOOD],
        },
        include: { units: true },
      })) ??
      (await this.prisma.food.findFirst({
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
