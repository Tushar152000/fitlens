/**
 * Shapes of the FitLens API responses the app reads. They mirror the server (prisma/schema.prisma,
 * src/lib/services/*); when an API changes, update the type here.
 */
import type { MealType } from "./format";

export type { MealType };
export type Sex = "MALE" | "FEMALE";
export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "VERY_ACTIVE" | "ATHLETE";
export type DietType = "VEG" | "NON_VEG" | "EGGETARIAN" | "VEGAN";
export type Experience = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type Equipment = "FULL_GYM" | "DUMBBELLS" | "BODYWEIGHT";
export type GoalType = "FAT_LOSS" | "MUSCLE_GAIN" | "RECOMPOSITION";
export type MealStatus = "PENDING" | "ANALYZING" | "READY" | "CONFIRMED" | "FAILED";
export type Energy = "great" | "ok" | "tired";

export interface Profile {
  userId: string;
  sex: Sex;
  birthDate: string;
  heightCm: number;
  activityLevel: ActivityLevel;
  dietType: DietType;
  experience: Experience;
  equipment: Equipment;
  trainingDaysPerWeek: number;
  sessionMinutes: number;
  injuries: string[];
  medicalFlag: boolean;
  timezone: string;
  remindLunch: boolean;
  remindDinner: boolean;
  onboardedAt: string | null;
}

export interface Me {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  onboarded: boolean;
  profile: Profile | null;
}

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealItem extends Macros {
  id: string;
  foodId: string | null;
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  aiConfidence: number | null;
  approximate: boolean;
  edited: boolean;
  isLiquid: boolean;
}

export interface Meal {
  id: string;
  date: string;
  mealType: MealType;
  source: "PHOTO" | "TEXT";
  status: MealStatus;
  inputText: string | null;
  note: string | null;
  aiNotes: string | null;
  error: string | null;
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  createdAt: string;
  items: MealItem[];
  photoUrl?: string | null;
}

export interface Day {
  date: string;
  target: (Macros & { reason: string | null }) | null;
  eaten: Macros;
  remainingKcal: number | null;
  meals: Meal[];
  streak: number;
  timezone: string;
}

export interface Prescription {
  slug: string;
  name: string;
  slot: string;
  role: "main" | "secondary" | "accessory";
  sets: number;
  repMin: number;
  repMax: number;
  rir: number;
  restSec: number;
  targetKg: number | null;
  timed: boolean;
  note?: string;
}

export interface AdjustedExercise extends Prescription {
  plannedSets: number;
  bonusRep: boolean;
}

export interface CoachRule {
  title: string;
  reason: string;
}

export interface AdjustedSession {
  name: string;
  date: string;
  exercises: AdjustedExercise[];
  trimmed: boolean;
  estimatedMinutes: number;
  rules: CoachRule[];
}

export type DayState = "done" | "today" | "planned" | "missed" | "before" | "rest";

export interface SnackPick {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  usual?: boolean;
  log:
    | { kind: "usual"; mealId: string }
    | { kind: "items"; items: { foodId: string; quantity: number; unit: string; grams: number }[] };
}

export interface TodayWorkout {
  planId: string;
  phase: "deficit" | "maintenance" | "surplus";
  split: string;
  deload: boolean;
  sessionMinutes: number;
  cardio: string;
  notes: string[];
  strip: { date: string; name: string | null; state: DayState }[];
  session: AdjustedSession | null;
  completed: string[];
  nextDay: { date: string; name: string; exercises: Prescription[] } | null;
  fuel: { ratio: number; low: boolean; eatenKcal: number; targetKcal: number };
  snack: SnackPick | null;
}
