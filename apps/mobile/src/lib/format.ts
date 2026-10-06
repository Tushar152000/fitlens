/** Copied from the web app (src/lib/format.ts). Keep the two in step. */
import type { MealTypeValue } from "@fitr8/contracts";

export type MealType = MealTypeValue;

export const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"];

export const MEAL_LABEL: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  SNACK: "Snack",
  DINNER: "Dinner",
};

/** Default meal type for the hour of day (local to the device). */
export function mealTypeForHour(hour: number): MealType {
  if (hour >= 4 && hour < 11) return "BREAKFAST";
  if (hour >= 11 && hour < 16) return "LUNCH";
  if (hour >= 16 && hour < 19) return "SNACK";
  return "DINNER";
}

const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** 2050 → "2,050" */
export function formatInt(n: number): string {
  return nf.format(Math.round(n));
}

/** 1.5 → "1.5", 2 → "2" */
export function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

const PLURAL: Record<string, string> = {
  piece: "pieces",
  katori: "katori",
  cup: "cups",
  bowl: "bowls",
  plate: "plates",
  glass: "glasses",
  tbsp: "tbsp",
  tsp: "tsp",
  sachet: "sachets",
  cube: "cubes",
  can: "cans",
  bottle: "bottles",
  scoop: "scoops",
  mug: "mugs",
  shot: "shots",
  g: "g",
};

/** "2 pieces · 80 g", or "1 cup · 180 ml" for drinks (1 ml ≈ 1 g). */
export function formatPortion(quantity: number, unit: string, grams: number, liquid = false): string {
  if (unit === "g" || unit === "ml") return `${formatQty(quantity)} ${unit}`;
  const u = quantity === 1 ? unit : (PLURAL[unit] ?? unit);
  return `${formatQty(quantity)} ${u} · ${formatInt(grams)} ${liquid ? "ml" : "g"}`;
}

/** Stepper increment per household unit. Pieces are whole; bowls and katori go by halves. */
export function unitStep(unit: string): number {
  if (unit === "g") return 10;
  if (["piece", "tsp", "tbsp", "sachet", "cube", "scoop", "shot", "can"].includes(unit)) return 1;
  return 0.5;
}

/** "13:15" in the given timezone. */
export function formatTime(date: Date | string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(date));
}

export const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Roti, dal tadka +2 more" from item names. */
export function mealTitle(names: string[], fallback: string): string {
  if (!names.length) return sentenceCase(fallback);
  const shown = names.slice(0, 2).join(", ");
  const rest = names.length - 2;
  return sentenceCase(rest > 0 ? `${shown} +${rest} more` : shown);
}

/** The meal to offer next: first unlogged from the current time of day onwards, then any missed earlier one, else a snack. */
export function nextMealType(logged: Iterable<MealType>, hour: number): MealType {
  const done = new Set(logged);
  const start = MEAL_TYPES.indexOf(mealTypeForHour(hour));
  const ordered = [...MEAL_TYPES.slice(start), ...MEAL_TYPES.slice(0, start)];
  return ordered.find((t) => t !== "SNACK" && !done.has(t)) ?? "SNACK";
}
