/**
 * JSON-wire shapes of every API response the clients read. The API's controllers are annotated with
 * these types, so the compiler checks the server against them; web and mobile import them instead
 * of declaring their own copies. Dates travel as ISO strings (`Jsonify` below).
 */
import type {
  AdjustedExercise,
  AdjustedSession,
  CoachRule,
  NextTarget,
  PlanDay,
  Prescription,
  SnackOption,
  WeekPlan,
} from "@fitlens/domain/training";
import type { LabelRead } from "./ai.js";
import type { MealTypeValue, OnboardingInput } from "./requests.js";

export type { AdjustedExercise, AdjustedSession, CoachRule, NextTarget, PlanDay, Prescription };

/**
 * What `JSON.stringify` makes of a value, at the type level: `Date` becomes its ISO string, recursively.
 * The API uses it to check a service's return value (which may hold Dates) against a DTO.
 */
export type Jsonify<T> = T extends Date
  ? string
  : T extends string | number | boolean | null | undefined
    ? T
    : T extends readonly (infer U)[]
      ? Jsonify<U>[]
      : T extends object
        ? { [K in keyof T]: Jsonify<T[K]> }
        : T;

// ── Enums (as stored in the database) ─────────────────────────────────────

export type Sex = OnboardingInput["sex"];
export type ActivityLevel = OnboardingInput["activityLevel"];
export type DietType = OnboardingInput["dietType"];
export type Experience = OnboardingInput["experience"];
export type Equipment = OnboardingInput["equipment"];
export type GoalType = OnboardingInput["goal"]["type"];
export type MealStatus = "PENDING" | "ANALYZING" | "READY" | "CONFIRMED" | "FAILED";
export type MealSource = "PHOTO" | "TEXT";
export type FoodSource =
  "IFCT" | "INDB" | "USDA" | "CUSTOM" | "AI_ESTIMATE" | "OPEN_FOOD_FACTS" | "LABEL_SCAN";

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** `{ id }` of the row a POST created (log-items, quick-add, relog, label scan, label save). */
export interface CreatedDto {
  id: string;
}

// ── Auth and users ────────────────────────────────────────────────────────

/** GET /api/auth/providers */
export interface ProvidersDto {
  google: boolean;
  dev: boolean;
}

/** POST /api/mobile/token */
export interface MobileTokenDto {
  token: string;
  expires: string;
}

/** POST /api/auth/dev (local development only) */
export interface DevLoginDto extends MobileTokenDto {
  userId: string;
}

/** The `profiles` row. */
export interface ProfileDto {
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
  remindWater: boolean;
  onboardedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/me */
export interface MeDto {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  onboarded: boolean;
  profile: ProfileDto | null;
}

/** PATCH /api/profile/reminders */
export interface RemindersDto {
  remindLunch: boolean;
  remindDinner: boolean;
  remindWater: boolean;
}

// ── Plan ──────────────────────────────────────────────────────────────────

/** The `daily_targets` row. */
export interface DailyTargetDto extends Macros {
  id: string;
  userId: string;
  goalId: string | null;
  effectiveFrom: string;
  reason: string;
  createdAt: string;
}

/** The "Your plan" summary. POST /api/onboarding returns it; GET /api/plan nests it. */
export interface PlanSummaryDto {
  bmi: { value: number; category: string };
  bodyFatPct: number | null;
  target: DailyTargetDto;
  plan: {
    bmr: number;
    tdee: number;
    targetWeightKg: number;
    weeklyChangeKg: number;
    neededWeeklyChangeKg: number;
    feasible: boolean;
    suggestedTargetDate?: string;
    closerTargetWeightKg?: number;
    warnings: string[];
  };
}

/** GET /api/targets */
export interface TargetsDto {
  target: DailyTargetDto;
}

/** GET /api/plan */
export interface PlanDto {
  summary: PlanSummaryDto;
  goal: {
    type: GoalType;
    targetDate: string;
    targetWeightKg: number | null;
    targetBodyFatPct: number | null;
  };
  metric: {
    date: string;
    bodyFatPct: number | null;
    weightKg: number;
    waistCm: number | null;
    neckCm: number | null;
    hipCm: number | null;
  };
  training: { daysPerWeek: number; sessionMinutes: number };
}

/** POST /api/goal/option */
export type GoalOptionDto =
  { ok: true; changed: false } | { ok: true; changed: true; target: DailyTargetDto };

// ── Meals ─────────────────────────────────────────────────────────────────

/** The `meal_items` row. */
export interface MealItemDto extends Macros {
  id: string;
  mealLogId: string;
  foodId: string | null;
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  aiConfidence: number | null;
  aiGrams: number | null;
  approximate: boolean;
  edited: boolean;
  isLiquid: boolean;
}

/** The `meal_logs` row with its items (GET /api/meals, PUT /api/meals/:id, POST /api/meals when analysed inline). */
export interface MealLogDto {
  id: string;
  userId: string;
  date: string;
  mealType: MealTypeValue;
  source: MealSource;
  photoKey: string | null;
  inputText: string | null;
  status: MealStatus;
  /** The model's raw output (JSON); clients read only optional hints from it. */
  aiRaw: unknown;
  aiNotes: string | null;
  note: string | null;
  error: string | null;
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: MealItemDto[];
}

/** GET /api/meals/:id — the log with a short-lived photo link. */
export interface MealDetailDto extends MealLogDto {
  photoUrl: string | null;
}

/** GET /api/meals?date= */
export interface MealListDto {
  meals: MealLogDto[];
}

/** POST /api/meals when the analysis was queued (202). */
export interface MealQueuedDto {
  id: string;
  status: "PENDING";
}

/** POST /api/meals: 202 queued, or 201 with the analysed (or empty manual) log. */
export type CreateMealDto = MealLogDto | MealQueuedDto;

/** POST /api/meals/:id/recheck: 202 queued, or 200 "DONE" when analysed inline. */
export interface RecheckDto {
  id: string;
  status: "PENDING" | "DONE";
}

/** POST /api/meals/upload-url */
export interface UploadUrlDto {
  key: string;
  uploadUrl: string;
  expiresIn: number;
}

/** One priced item from POST /api/meals/parse-items (nothing is saved). */
export interface ParsedItemDto extends Macros {
  foodId: string | null;
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  approximate: boolean;
  isLiquid: boolean;
  aiConfidence: number;
}

/** POST /api/meals/parse-items */
export interface ParsedItemsDto {
  items: ParsedItemDto[];
}

/** GET /api/usage — photo scans used today (also the `details` of a 429 from a photo scan). */
export interface UsageDto {
  used: number;
  limit: number;
  left: number;
  resetsAt: string;
}

/** One entry of GET /api/meals/usuals. */
export interface UsualDto {
  mealId: string;
  mealType: MealTypeValue;
  count: number;
  names: string[];
  kcal: number;
  proteinG: number;
  carbsG: number;
}

/** GET /api/meals/usuals */
export interface UsualsDto {
  usuals: UsualDto[];
}

// ── Foods ─────────────────────────────────────────────────────────────────

/** The `foods` row. */
export interface FoodDto {
  id: string;
  name: string;
  aliases: string[];
  source: FoodSource;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
  isVeg: boolean;
  isLiquid: boolean;
  barcode: string | null;
  brand: string | null;
  servingSizeG: number | null;
  servingLabel: string | null;
  imageUrl: string | null;
  sugarPer100g: number | null;
  sodiumMgPer100g: number | null;
  verified: boolean;
  submittedById: string | null;
  createdAt: string;
}

/** One hit of GET /api/foods?q= */
export interface FoodHitDto {
  id: string;
  name: string;
  per100g: { kcal: number; protein: number; carbs: number; fat: number };
  units: { unit: string; grams: number }[];
  isLiquid: boolean;
}

/** GET /api/foods?q= */
export interface FoodSearchDto {
  foods: FoodHitDto[];
}

/** GET /api/foods/barcode/:code (404 with `details.code` for an unknown product). */
export interface BarcodeProductDto {
  code: string;
  food: FoodDto | null;
}

/** GET /api/foods/label/:id — the values read from a label photo, for the user to check. */
export interface LabelScanDto {
  id: string;
  name: string;
  per100g: LabelRead["per100g"];
  servingSizeG: number | null;
  servingLabel: string | null;
}

// ── Progress ──────────────────────────────────────────────────────────────

/** GET /api/dashboard — one meal, without the raw model output. */
export interface DashboardMealDto extends Omit<MealLogDto, "aiRaw"> {
  photoUrl: string | null;
}

/** GET /api/dashboard?date= */
export interface DashboardDto {
  date: string;
  target: (Macros & { reason: string }) | null;
  eaten: Macros;
  remainingKcal: number | null;
  meals: DashboardMealDto[];
  streak: number;
  timezone: string;
}

/** One day of GET /api/history. */
export interface HistoryDayDto {
  /** YYYY-MM-DD */
  date: string;
  /** Confirmed meals only. */
  kcal: number;
  proteinG: number;
  /** The target in effect that day. */
  target: number | null;
  logged: boolean;
  isToday: boolean;
  meals: { id: string; mealType: MealTypeValue; title: string; kcal: number; createdAt: string }[];
}

/** GET /api/history?days=7|30 */
export interface HistoryDto {
  days: HistoryDayDto[];
  daysLogged: number;
  avgKcalFullDays: number | null;
}

/** The `body_metrics` row (a weigh-in). */
export interface BodyMetricDto {
  id: string;
  userId: string;
  date: string;
  weightKg: number;
  waistCm: number | null;
  neckCm: number | null;
  hipCm: number | null;
  bodyFatPct: number | null;
  createdAt: string;
}

/** POST /api/checkins */
export interface CheckinDto {
  metric: BodyMetricDto;
}

/** GET /api/checkins */
export interface CheckinsDto {
  metrics: BodyMetricDto[];
}

/** GET /api/progress */
export interface ProgressDto {
  points: { date: string; weightKg: number; avg7: number }[];
  latest: BodyMetricDto | null;
  plan: {
    startDate: string;
    targetDate: string;
    startWeightKg: number;
    targetWeightKg: number;
    weeklyChangeKg: number;
    goalType: GoalType;
  };
  weeklyChange: number | null;
  target: { kcal: number; reason: string; effectiveFrom: string } | null;
  avgIntake: number | null;
  daysLogged: number;
}

// ── Water ─────────────────────────────────────────────────────────────────

/** GET /api/water and POST /api/water */
export interface WaterDayDto {
  date: string;
  targetMl: number;
  reason: string;
  tip: string;
  caution: string | null;
  trainingDay: boolean;
  consumedMl: number;
  logs: { id: string; ml: number; createdAt: string }[];
  remind: boolean;
}

// ── Workouts ──────────────────────────────────────────────────────────────

/** "before" is a training day that fell before this week's first plan existed, so not a miss. */
export type DayState = "done" | "today" | "planned" | "missed" | "before" | "rest";

/** The pre-workout snack suggestion, with what to send to log it. */
export type SnackPickDto = SnackOption & {
  log:
    | { kind: "usual"; mealId: string }
    | { kind: "items"; items: { foodId: string; quantity: number; unit: string; grams: number }[] };
};

/** GET /api/workouts/today?energy= */
export interface TodayWorkoutDto {
  planId: string;
  phase: WeekPlan["phase"];
  split: string;
  deload: boolean;
  sessionMinutes: number;
  cardio: string;
  notes: string[];
  strip: { date: string; name: string | null; state: DayState }[];
  session: AdjustedSession | null;
  completed: string[];
  nextDay: { date: string; name: string; exercises: PlanDay["exercises"] } | null;
  fuel: { ratio: number; low: boolean; eatenKcal: number; targetKcal: number };
  snack: SnackPickDto | null;
}

/** POST /api/workouts/logs */
export interface WorkoutLogResultDto {
  exerciseSlug: string;
  next: NextTarget;
}

/** POST /api/workouts/generate */
export interface GeneratedPlanDto {
  id: string;
  weekStart: string;
  version: number;
  plan: WeekPlan;
}
