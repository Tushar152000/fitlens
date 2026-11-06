import type { BillingDto } from "@fitr8/contracts";
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
