import type { SavedMealDto, SavedMealInput } from "@fitr8/contracts";
import { toConfirmPayload, type Row } from "./meal-rows";
import type { MealType } from "./format";

/** Saved meal items → editable rows (same editor as meal review). */
export function rowsFromSaved(meal: SavedMealDto): Row[] {
  return meal.items.map((i) => ({
    key: i.id,
    foodId: i.foodId,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    grams: i.grams,
    kcal: i.kcal,
    proteinG: i.proteinG,
    carbsG: i.carbsG,
    fatG: i.fatG,
    approximate: i.approximate,
    isLiquid: i.isLiquid,
  }));
}

/** Rows → POST/PUT /api/saved-meals body. Estimated items carry their own per-100 g values. */
export function toSavedPayload(name: string, mealType: MealType | null, rows: Row[], ghee = false): SavedMealInput {
  const { items } = toConfirmPayload(rows, ghee);
  return { name: name.trim(), mealType, items: items.map(({ id: _id, ...item }) => item) };
}
