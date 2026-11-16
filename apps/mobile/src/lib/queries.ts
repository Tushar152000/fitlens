import type { BillingDto, ReminderListDto, SavedMealsDto } from "@fitr8/contracts";
import { api } from "./api";
import type { Day, Energy, TodayWorkout, WaterDay } from "./types";

/** Shared query definitions, so screens that show the same data share one cache entry. */
export const dayQuery = { queryKey: ["day"], queryFn: () => api<Day>("/api/dashboard") };

export const workoutQuery = (energy: Energy = "ok") => ({
  queryKey: ["workout", energy],
  queryFn: () => api<TodayWorkout>(`/api/workouts/today?energy=${energy}`),
});

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
