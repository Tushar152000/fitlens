import type { GoalType, Macros } from "./types";

/**
 * Protein 1.8 g/kg in a deficit, 1.6 g/kg otherwise (max 2.2 g/kg);
 * fat 25% of calories (min 0.6 g/kg); carbs fill the rest.
 */
export function macrosFor(kcal: number, weightKg: number, goal: GoalType): Macros {
  const proteinPerKg = goal === "FAT_LOSS" ? 1.8 : 1.6;
  const proteinG = Math.min(proteinPerKg, 2.2) * weightKg;
  const fatG = Math.max((kcal * 0.25) / 9, 0.6 * weightKg);
  const carbsG = Math.max(0, (kcal - proteinG * 4 - fatG * 9) / 4);
  return {
    kcal: Math.round(kcal),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbsG: Math.round(carbsG),
  };
}

/** Nutrition for a portion, from per-100 g values. */
export function scaleNutrition(
  per100g: { kcal: number; protein: number; carbs: number; fat: number },
  grams: number,
): Macros {
  const f = grams / 100;
  return {
    kcal: round1(per100g.kcal * f),
    proteinG: round1(per100g.protein * f),
    carbsG: round1(per100g.carbs * f),
    fatG: round1(per100g.fat * f),
  };
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (a, b) => ({
      kcal: round1(a.kcal + b.kcal),
      proteinG: round1(a.proteinG + b.proteinG),
      carbsG: round1(a.carbsG + b.carbsG),
      fatG: round1(a.fatG + b.fatG),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;
