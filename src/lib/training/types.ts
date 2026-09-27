import { z } from "zod";

export type Phase = "deficit" | "maintenance" | "surplus";
export type Equipment = "FULL_GYM" | "DUMBBELLS" | "BODYWEIGHT";
export type Experience = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type Energy = "great" | "ok" | "tired";

export type Slot =
  | "horizontal_push"
  | "incline_push"
  | "horizontal_pull"
  | "vertical_push"
  | "vertical_pull"
  | "lateral_delt"
  | "rear_delt"
  | "biceps"
  | "triceps"
  | "arms"
  | "squat"
  | "hinge"
  | "single_leg"
  | "leg_curl"
  | "calves"
  | "core";

export type LoadType = "barbell" | "dumbbell" | "machine" | "bodyweight";

export interface ExerciseDef {
  slug: string;
  name: string;
  slot: Slot;
  muscleGroup: string;
  /** Good as a session's main lift. */
  isMain: boolean;
  /** Set-ups where it can be done; a gym user can also do dumbbell and bodyweight moves. */
  equipment: Equipment[];
  /** Injury keywords that rule it out, matched against the user's injuries. */
  avoidIf: string[];
  loadStepKg: number;
  load: LoadType;
  /** Held for time (plank) — "reps" are seconds. */
  timed?: boolean;
  /** Intermediate starting load as a share of bodyweight (per hand for dumbbells). */
  startRatio?: number;
}

/** One exercise as prescribed for a session. */
export const PrescriptionSchema = z.object({
  slug: z.string(),
  name: z.string(),
  slot: z.string(),
  role: z.enum(["main", "secondary", "accessory"]),
  sets: z.number().int().min(1).max(8),
  repMin: z.number().int().positive(),
  repMax: z.number().int().positive(),
  rir: z.number().int().min(0).max(5),
  restSec: z.number().int().positive(),
  targetKg: z.number().nonnegative().nullable(),
  timed: z.boolean(),
  /** Why the load or sets are what they are (progression rule). */
  note: z.string().optional(),
});
export type Prescription = z.infer<typeof PrescriptionSchema>;

export const PlanDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string(),
  exercises: z.array(PrescriptionSchema).min(1),
});
export type PlanDay = z.infer<typeof PlanDaySchema>;

/** The `WorkoutPlan.plan` JSON (docs/DESIGN.md → Workout coach engine → API). */
export const WeekPlanSchema = z.object({
  phase: z.enum(["deficit", "maintenance", "surplus"]),
  split: z.string(),
  deload: z.boolean(),
  deficitPct: z.number(),
  sessionMinutes: z.number().int().positive(),
  cardio: z.string(),
  notes: z.array(z.string()),
  days: z.array(PlanDaySchema),
});
export type WeekPlan = z.infer<typeof WeekPlanSchema>;

/** A logged set. */
export interface SetLog {
  kg: number | null;
  reps: number;
  rir?: number;
}

/** One past session of one exercise, newest first when passed as history. */
export interface ExerciseSession {
  date: string;
  sets: SetLog[];
  rx: Pick<Prescription, "sets" | "repMin" | "repMax" | "rir" | "targetKg">;
}
