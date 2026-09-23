export type Sex = "MALE" | "FEMALE";
export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "VERY_ACTIVE" | "ATHLETE";
export type GoalType = "FAT_LOSS" | "MUSCLE_GAIN" | "RECOMPOSITION";

export interface BodyStats {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  bodyFatPct?: number;
}

export interface GoalInput {
  type: GoalType;
  targetWeightKg?: number;
  targetBodyFatPct?: number;
  startDate: Date;
  targetDate: Date;
}

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
