/** Copied from the web app (src/app/(app)/log/[id]/rows.ts). Keep the two in step. */
/** Editable meal items on the confirm screen. Nutrition scales linearly with quantity. */
export interface Row {
  key: string;
  id?: string; // existing MealItem
  foodId?: string | null;
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence?: number | null;
  approximate?: boolean;
  isLiquid?: boolean;
}

export interface ItemDto {
  id: string;
  foodId: string | null;
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  aiConfidence: number | null;
  approximate: boolean;
  isLiquid: boolean;
}

/** The ghee/oil switch = 1 tsp ghee: +45 kcal, +5 g fat. */
export const GHEE = {
  name: "ghee",
  quantity: 1,
  unit: "tsp",
  grams: 5,
  kcal: 45,
  proteinG: 0,
  carbsG: 0,
  fatG: 5,
};

const ADDED_FAT = new Set(["ghee", "cooking oil"]);

/** Split saved items into editable rows and the ghee switch (a saved 1 tsp ghee item turns it on). */
export function fromItems(items: ItemDto[]): { rows: Row[]; ghee: boolean } {
  let ghee = false;
  const rows: Row[] = [];
  for (const i of items) {
    if (!ghee && ADDED_FAT.has(i.name) && i.unit === "tsp" && i.quantity === 1) {
      ghee = true;
      continue;
    }
    rows.push({
      key: i.id,
      id: i.id,
      foodId: i.foodId,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      grams: i.grams,
      kcal: i.kcal,
      proteinG: i.proteinG,
      carbsG: i.carbsG,
      fatG: i.fatG,
      confidence: i.aiConfidence,
      approximate: i.approximate,
      isLiquid: i.isLiquid,
    });
  }
  return { rows, ghee };
}

/** New quantity; grams and macros scale by the same factor. */
export function scaleRow(row: Row, quantity: number): Row {
  const f = row.quantity > 0 ? quantity / row.quantity : 0;
  return {
    ...row,
    quantity,
    grams: row.grams * f,
    kcal: row.kcal * f,
    proteinG: row.proteinG * f,
    carbsG: row.carbsG * f,
    fatG: row.fatG * f,
  };
}

/** A user-set amount (grams, or ml for drinks). Keeps the count; macros scale with the amount. */
export function setRowGrams(row: Row, grams: number): Row {
  const f = row.grams > 0 ? grams / row.grams : 0;
  return {
    ...row,
    grams,
    kcal: row.kcal * f,
    proteinG: row.proteinG * f,
    carbsG: row.carbsG * f,
    fatG: row.fatG * f,
  };
}

/** A row for a food picked from the database. */
export function rowFromFood(
  food: {
    id: string;
    name: string;
    per100g: { kcal: number; protein: number; carbs: number; fat: number };
    isLiquid?: boolean;
  },
  unit: { unit: string; grams: number },
  quantity = 1,
): Row {
  const grams = unit.grams * quantity;
  const k = grams / 100;
  return {
    key: `new-${food.id}-${Date.now()}`,
    foodId: food.id,
    name: food.name,
    quantity,
    unit: unit.unit,
    grams,
    kcal: food.per100g.kcal * k,
    proteinG: food.per100g.protein * k,
    carbsG: food.per100g.carbs * k,
    fatG: food.per100g.fat * k,
    isLiquid: food.isLiquid ?? false,
  };
}

export function totals(rows: Row[], ghee: boolean) {
  const all = ghee ? [...rows, GHEE] : rows;
  return all.reduce(
    (t, r) => ({
      kcal: t.kcal + r.kcal,
      proteinG: t.proteinG + r.proteinG,
      carbsG: t.carbsG + r.carbsG,
      fatG: t.fatG + r.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * PUT /api/meals/[id] body. Items not in the food list send their own per-100 g values,
 * so saving never re-prices an estimate to 0 kcal.
 */
export function toConfirmPayload(rows: Row[], ghee: boolean, note?: string | null) {
  const items = rows.map((r) => {
    const per = r.grams > 0 ? 100 / r.grams : 0;
    return {
      id: r.id,
      foodId: r.foodId ?? undefined,
      name: r.name,
      quantity: r.quantity,
      unit: r.unit,
      grams: Math.max(1, Math.round(r.grams)),
      per100g: r.foodId
        ? undefined
        : {
            kcal: round1(r.kcal * per),
            protein: round1(r.proteinG * per),
            carbs: round1(r.carbsG * per),
            fat: round1(r.fatG * per),
          },
      isLiquid: r.isLiquid ?? false,
    };
  });
  if (ghee) {
    items.push({ id: undefined, foodId: undefined, ...GHEE, per100g: undefined, isLiquid: false });
  }
  return { items, note: note?.trim() ? note.trim() : null };
}
