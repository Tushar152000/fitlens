import { api } from "./api";
import type { Day, Energy, TodayWorkout, WaterDay } from "./types";

/** Shared query definitions, so screens that show the same data share one cache entry. */
export const dayQuery = { queryKey: ["day"], queryFn: () => api<Day>("/api/dashboard") };

export const workoutQuery = (energy: Energy = "ok") => ({
  queryKey: ["workout", energy],
  queryFn: () => api<TodayWorkout>(`/api/workouts/today?energy=${energy}`),
});

export const waterQuery = { queryKey: ["water"], queryFn: () => api<WaterDay>("/api/water") };
