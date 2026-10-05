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

export const ConfirmMealSchema = z.object({
  items: z
    .array(
      z.object({
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
      }),
    )
    .min(1),
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
});

export const GoalOptionSchema = z.object({
  choice: z.enum(["KEEP_GOAL", "KEEP_DATE"]),
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

// ---------- Inferred input types (one per schema) ----------
export type MealTypeValue = z.infer<typeof MealTypeSchema>;
export type UploadUrlInput = z.infer<typeof UploadUrlSchema>;
export type CreateMealInput = z.infer<typeof CreateMealSchema>;
export type ConfirmMealInput = z.infer<typeof ConfirmMealSchema>;
export type RecheckInput = z.infer<typeof RecheckSchema>;
export type CheckinInput = z.infer<typeof CheckinSchema>;
export type ParseItemsInput = z.infer<typeof ParseItemsSchema>;
export type RelogInput = z.infer<typeof RelogSchema>;
export type GoalOptionInput = z.infer<typeof GoalOptionSchema>;
export type RemindersInput = z.infer<typeof RemindersSchema>;
export type PreferredNameInput = z.infer<typeof PreferredNameSchema>;
export type WaterAddInput = z.infer<typeof WaterAddSchema>;
export type QuickAddInput = z.infer<typeof QuickAddSchema>;
export type LabelScanInput = z.infer<typeof LabelScanSchema>;
export type LabelSaveInput = z.infer<typeof LabelSaveSchema>;
export type EnergyLevel = z.infer<typeof EnergySchema>;
export type WorkoutLogInput = z.infer<typeof WorkoutLogSchema>;
export type LogItemsInput = z.infer<typeof LogItemsSchema>;
