import { z } from "zod";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const OnboardingSchema = z
  .object({
    sex: z.enum(["MALE", "FEMALE"]),
    birthDate: ymd,
    heightCm: z.number().min(120).max(230),
    weightKg: z.number().min(30).max(250),
    waistCm: z.number().min(40).max(200).optional(),
    neckCm: z.number().min(20).max(70).optional(),
    hipCm: z.number().min(50).max(200).optional(),
    activityLevel: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "VERY_ACTIVE", "ATHLETE"]),
    dietType: z.enum(["VEG", "NON_VEG", "EGGETARIAN", "VEGAN"]),
    experience: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
    equipment: z.enum(["FULL_GYM", "DUMBBELLS", "BODYWEIGHT"]),
    trainingDaysPerWeek: z.number().int().min(2).max(6).default(3),
    sessionMinutes: z.number().int().min(15).max(120).default(45),
    injuries: z.array(z.string().max(60)).max(10).default([]),
    medicalFlag: z.boolean().default(false),
    timezone: z.string().default("Asia/Kolkata"),
    goal: z.object({
      type: z.enum(["FAT_LOSS", "MUSCLE_GAIN", "RECOMPOSITION"]),
      targetWeightKg: z.number().min(30).max(250).optional(),
      targetBodyFatPct: z.number().min(5).max(50).optional(),
      targetDate: ymd,
    }),
  })
  .refine(
    (d) => d.goal.type === "RECOMPOSITION" || d.goal.targetWeightKg || d.goal.targetBodyFatPct,
    {
      message: "Give a target weight or target body fat",
      path: ["goal"],
    },
  )
  .refine((d) => !d.goal.targetBodyFatPct || (d.waistCm && d.neckCm), {
    message: "A body-fat goal needs waist and neck measurements",
    path: ["waistCm"],
  });

export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export const MealTypeSchema = z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);

export const UploadUrlSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});

export const CreateMealSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("PHOTO"),
    mealType: MealTypeSchema,
    photoKey: z.string().min(1),
    date: ymd.optional(),
  }),
  z.object({
    source: z.literal("TEXT"),
    mealType: MealTypeSchema,
    text: z.string().min(2).max(500),
    date: ymd.optional(),
  }),
  // No AI: an empty meal the user fills from the food database (e.g. after the daily AI limit).
  z.object({
    source: z.literal("MANUAL"),
    mealType: MealTypeSchema,
    date: ymd.optional(),
  }),
]);

/** One item as the user confirmed it (meal review, saved-meal builder). */
export const MealItemInputSchema = z.object({
  id: z.string().optional(), // existing item, if the user edited one
  foodId: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  grams: z.number().positive().max(3000),
  // Only used when the item isn't in the food list (an AI estimate).
  per100g: z
    .object({
      kcal: z.number().nonnegative().max(900),
      protein: z.number().nonnegative().max(100),
      carbs: z.number().nonnegative().max(100),
      fat: z.number().nonnegative().max(100),
    })
    .optional(),
  isLiquid: z.boolean().optional(),
});

export const ConfirmMealSchema = z.object({
  items: z.array(MealItemInputSchema).min(1),
  note: z.string().trim().max(500).nullable().optional(),
});

/** Re-run analysis; with a note ("small cup, 2 sachets sugar") or without (plain retry). */
export const RecheckSchema = z.object({
  note: z.string().trim().min(2).max(500).optional(),
});

export const CheckinSchema = z.object({
  date: ymd.optional(),
  weightKg: z.number().min(30).max(250),
  waistCm: z.number().min(40).max(200).optional(),
  neckCm: z.number().min(20).max(70).optional(),
  hipCm: z.number().min(50).max(200).optional(),
});

export const ParseItemsSchema = z.object({
  text: z.string().trim().min(2).max(300),
  mealType: MealTypeSchema,
});

export const RelogSchema = z.object({
  mealId: z.string().min(1),
  mealType: MealTypeSchema,
  date: ymd.optional(),
});

export const GoalOptionSchema = z.object({
  choice: z.enum(["KEEP_GOAL", "KEEP_DATE"]),
});

/**
 * POST /api/welcome-back: back after a long break (MeDto.welcomeBack), only the numbers that change
 * over time. Sex, birth date, diet, experience and the goal are kept. Ranges match onboarding.
 */
export const WelcomeBackSchema = z.object({
  weightKg: z.number().min(30).max(250),
  heightCm: z.number().min(120).max(230),
  /** Needed when the active goal is a body-fat target (fresh body fat from the Navy formula). */
  waistCm: z.number().min(40).max(200).optional(),
  neckCm: z.number().min(20).max(70).optional(),
  hipCm: z.number().min(50).max(200).optional(),
  activityLevel: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "VERY_ACTIVE", "ATHLETE"]),
  equipment: z.enum(["FULL_GYM", "DUMBBELLS", "BODYWEIGHT"]),
  trainingDaysPerWeek: z.number().int().min(2).max(6),
  sessionMinutes: z.number().int().min(15).max(120),
  injuries: z.array(z.string().max(60)).max(10),
  /** Pregnancy or a medical condition can start during a break: no calorie deficit when true. */
  medicalFlag: z.boolean(),
  timezone: z.string().default("Asia/Kolkata"),
});

export const RemindersSchema = z.object({
  lunch: z.boolean().optional(),
  dinner: z.boolean().optional(),
  water: z.boolean().optional(),
});

/** Web welcome flow, "Preferred first name". */
export const PreferredNameSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

/** One water tap: a glass (250 ml), a bottle (500 ml), or a custom amount. */
export const WaterAddSchema = z.object({
  ml: z.number().int().min(50).max(2000),
});

export const QuickAddSchema = z.object({
  foodId: z.string().min(1),
  mealType: MealTypeSchema,
  quantity: z.number().positive().max(100),
  unit: z.string().min(1).max(20),
  grams: z.number().positive().max(5000),
  date: ymd.optional(),
});

export const LabelScanSchema = z.object({
  photoKey: z.string().min(1),
  barcode: z.string().max(20).optional(),
  name: z.string().max(120).optional(),
});

export const LabelSaveSchema = z.object({
  name: z.string().trim().min(2).max(120),
  per100g: z.object({
    kcal: z.number().nonnegative().max(900),
    protein: z.number().nonnegative().max(100),
    carbs: z.number().nonnegative().max(100),
    fat: z.number().nonnegative().max(100),
  }),
  servingSizeG: z.number().positive().max(2000).optional(),
  servingLabel: z.string().max(60).optional(),
  quantity: z.number().positive().max(100),
  unit: z.string().min(1).max(20),
  grams: z.number().positive().max(5000),
  mealType: MealTypeSchema,
  isLiquid: z.boolean().default(false),
  date: ymd.optional(),
});

export const EnergySchema = z.enum(["great", "ok", "tired"]);

export const WorkoutLogSchema = z.object({
  planId: z.string().min(1),
  exerciseSlug: z.string().min(1),
  sets: z
    .array(
      z.object({
        kg: z.number().nonnegative().max(500).nullable(),
        reps: z.number().int().min(0).max(300),
        rir: z.number().int().min(0).max(5).optional(),
      }),
    )
    .min(1)
    .max(10),
});

export const LogItemsSchema = z.object({
  mealType: MealTypeSchema,
  date: ymd.optional(),
  items: z
    .array(
      z.object({
        foodId: z.string().min(1),
        quantity: z.number().positive().max(100),
        unit: z.string().min(1).max(20),
        grams: z.number().positive().max(5000),
      }),
    )
    .min(1)
    .max(10),
});

// ---------- Saved meals (a user's own repeat meals, one tap to log) ----------

const savedMealName = z.string().trim().min(1, "Give it a name").max(60);

/** A saved meal from items (builder screen, or "Save as a meal" on review). Priced on the server. */
export const SavedMealSchema = z.object({
  name: savedMealName,
  /** The slot it's usually eaten in; only a default when logging it. */
  mealType: MealTypeSchema.nullable().optional(),
  items: z
    .array(MealItemInputSchema.omit({ id: true }))
    .min(1)
    .max(30),
});

/** Log a saved meal to a slot, today or a recent `date`. */
export const LogSavedMealSchema = z.object({
  mealType: MealTypeSchema,
  date: ymd.optional(),
});

// ---------- Reminders (scheduled on the phone; the server only stores them) ----------

/** One 5-field cron rule (L, L-1, 1#1, 5L and month names allowed). Checked on the server (domain `parseRules`). */
const cron = z
  .string()
  .trim()
  .max(120)
  .regex(/^\S+(\s+\S+){4}$/, "Use a 5-part schedule: minute hour day month weekday");

export const ReminderSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(60),
  description: z.string().trim().max(200).nullable().optional(),
  /** One rule per day-and-time pattern, e.g. ["0 9 1 * *", "0 18 L-1 * *"]. */
  crons: z.array(cron).min(1, "Add a time for the reminder").max(6),
  enabled: z.boolean().optional(),
  /** The words it was made from, kept so the user recognises it. */
  prompt: z.string().trim().max(300).nullable().optional(),
});

export const ReminderUpdateSchema = ReminderSchema.omit({ prompt: true }).partial();

/** "Remind me to take creatine every day at 9 am" → a draft to review. Nothing is saved. */
export const ReminderParseSchema = z.object({
  text: z.string().trim().min(3, "Tell us what to remind you about, and when").max(300),
});

// ---------- Inferred input types (one per schema) ----------
export type MealTypeValue = z.infer<typeof MealTypeSchema>;
export type UploadUrlInput = z.infer<typeof UploadUrlSchema>;
export type CreateMealInput = z.infer<typeof CreateMealSchema>;
export type ConfirmMealInput = z.infer<typeof ConfirmMealSchema>;
export type MealItemInput = z.infer<typeof MealItemInputSchema>;
export type RecheckInput = z.infer<typeof RecheckSchema>;
export type CheckinInput = z.infer<typeof CheckinSchema>;
export type ParseItemsInput = z.infer<typeof ParseItemsSchema>;
export type RelogInput = z.infer<typeof RelogSchema>;
export type GoalOptionInput = z.infer<typeof GoalOptionSchema>;
export type WelcomeBackInput = z.infer<typeof WelcomeBackSchema>;
export type RemindersInput = z.infer<typeof RemindersSchema>;
export type PreferredNameInput = z.infer<typeof PreferredNameSchema>;
export type WaterAddInput = z.infer<typeof WaterAddSchema>;
export type QuickAddInput = z.infer<typeof QuickAddSchema>;
export type LabelScanInput = z.infer<typeof LabelScanSchema>;
export type LabelSaveInput = z.infer<typeof LabelSaveSchema>;
export type EnergyLevel = z.infer<typeof EnergySchema>;
export type WorkoutLogInput = z.infer<typeof WorkoutLogSchema>;
export type LogItemsInput = z.infer<typeof LogItemsSchema>;
export type SavedMealInput = z.infer<typeof SavedMealSchema>;
export type LogSavedMealInput = z.infer<typeof LogSavedMealSchema>;
export type ReminderInput = z.infer<typeof ReminderSchema>;
export type ReminderUpdateInput = z.infer<typeof ReminderUpdateSchema>;
export type ReminderParseInput = z.infer<typeof ReminderParseSchema>;
