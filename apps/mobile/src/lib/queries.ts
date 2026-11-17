import type { BillingDto, ProgressDto, ReminderListDto, SavedMealsDto } from "@fitr8/contracts";
import { api } from "./api";
import type { Day, Energy, TodayWorkout, WaterDay } from "./types";

/** Shared query definitions, so screens that show the same data share one cache entry. */
export const dayQuery = { queryKey: ["day"], queryFn: () => api<Day>("/api/dashboard") };
/** One day on Today: null = today (shares `dayQuery`'s cache), else a recent past day. */
export const dayQueryFor = (date: string | null) =>
  date ? { queryKey: ["day", date], queryFn: () => api<Day>(`/api/dashboard?date=${date}`) } : dayQuery;

export const workoutQuery = (energy: Energy = "ok") => ({
  queryKey: ["workout", energy],
  queryFn: () => api<TodayWorkout>(`/api/workouts/today?energy=${energy}`),
});

/** GET /api/progress: Today's Progress card and the Progress screen (same key, one fetch). */
export const progressQuery = { queryKey: ["progress"], queryFn: () => api<ProgressDto>("/api/progress") };
export const waterQuery = { queryKey: ["water"], queryFn: () => api<WaterDay>("/api/water") };

/** GET /api/billing: plan, renewal and today's limits (FITR8 Pro). */
export const billingQuery = { queryKey: ["billing"], queryFn: () => api<BillingDto>("/api/billing") };

/** GET /api/saved-meals: the user's own repeat meals (builder, one-tap log). */
export const savedMealsQuery = {
  queryKey: ["saved-meals"],
  queryFn: () => api<SavedMealsDto>("/api/saved-meals").then((r) => r.savedMeals),
};

/** GET /api/reminders: the user's reminders; the phone schedules them locally. */
export const remindersQuery = {
  queryKey: ["reminders"],
  queryFn: () => api<ReminderListDto>("/api/reminders"),
};
