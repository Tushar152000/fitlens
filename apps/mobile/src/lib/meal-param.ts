import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { MEAL_TYPES, type MealType } from "./format";

/**
 * How many days back a forgotten meal can be logged. Same rule as the API
 * (`@fitr8/domain/dates` MEAL_BACKFILL_DAYS); the server has the final say.
 */
export const MEAL_BACKFILL_DAYS = 7;

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-16" for a device-local date. */
export function localYmd(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today first, then each earlier day the API still accepts. */
export function recentDays(now = new Date()): string[] {
  return Array.from({ length: MEAL_BACKFILL_DAYS + 1 }, (_, i) =>
    localYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)),
  );
}

/** "Today", "Yesterday", else "Sat 15 Nov". Long form adds the weekday in full. */
export function dayLabel(ymd: string, now = new Date()): string {
  const [today, yesterday] = recentDays(now);
  if (ymd === today) return "Today";
  if (ymd === yesterday) return "Yesterday";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(y, m - 1, d),
  );
}

/** `?meal=DINNER` from a route, or null when the user hasn't chosen one yet. */
export function mealFromParam(value: string | string[] | undefined): MealType | null {
  const v = typeof value === "string" ? value.toUpperCase() : "";
  return MEAL_TYPES.includes(v as MealType) ? (v as MealType) : null;
}

/** `?date=YYYY-MM-DD` when it is a past day still in the window; null means today. */
export function dayFromParam(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  const days = recentDays();
  return days.includes(value) && value !== days[0] ? value : null;
}

/** Route params that carry the choice to the next log screen. */
export function choiceParams(mealType: MealType | null, date: string | null): { meal?: string; date?: string } {
  return { ...(mealType ? { meal: mealType } : {}), ...(date ? { date } : {}) };
}

/**
 * Which meal and which day the user is logging. The meal is never guessed from the clock: it starts
 * empty unless the route says (e.g. "Add lunch" on Today), and saving waits until it is picked.
 * The day defaults to today; a past day comes from the route or the picker.
 */
export function useMealChoice() {
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const [mealType, setMealTypeState] = useState<MealType | null>(() => mealFromParam(params.meal));
  const [date, setDateState] = useState<string | null>(() => dayFromParam(params.date));

  // Keep the route in step, so switching Type / Photo / Barcode keeps the choice.
  const setMealType = (m: MealType) => {
    setMealTypeState(m);
    router.setParams({ meal: m });
  };
  const setDate = (d: string | null) => {
    setDateState(d);
    router.setParams({ date: d ?? undefined });
  };

  return {
    mealType,
    setMealType,
    date,
    setDate,
    /** Spread into an API body: `{ date }` for a past day, nothing for today. */
    dateBody: date ? { date } : {},
    params: choiceParams(mealType, date),
  };
}
