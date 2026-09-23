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
      }),
    )
    .min(1),
});

export const CheckinSchema = z.object({
  date: ymd.optional(),
  weightKg: z.number().min(30).max(250),
  waistCm: z.number().min(40).max(200).optional(),
  neckCm: z.number().min(20).max(70).optional(),
  hipCm: z.number().min(50).max(200).optional(),
});
