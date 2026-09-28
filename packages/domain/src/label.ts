export interface Per100g {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Design 7g "Numbers add up": energy from macros (4P + 4C + 9F) within 15 % of the stated
 * energy. Very low-energy items (≤ 20 kcal, e.g. diet drinks) pass on an absolute 5 kcal margin.
 */
export function labelAddsUp(v: Per100g): { ok: boolean; fromMacros: number } {
  const fromMacros = 4 * v.protein + 4 * v.carbs + 9 * v.fat;
  if (v.kcal <= 20) return { ok: Math.abs(fromMacros - v.kcal) <= 5, fromMacros };
  return { ok: Math.abs(fromMacros - v.kcal) <= v.kcal * 0.15, fromMacros };
}
