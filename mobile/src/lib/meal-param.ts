import { MEAL_TYPES, mealTypeForHour, type MealType } from "./format";

/** `?meal=DINNER` from a route, else the meal for the current hour. */
export function mealFromParam(value: string | string[] | undefined): MealType {
  const v = typeof value === "string" ? value.toUpperCase() : "";
  return MEAL_TYPES.includes(v as MealType) ? (v as MealType) : mealTypeForHour(new Date().getHours());
}
