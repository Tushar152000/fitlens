import type { LabelRead, MealAnalysis, ReminderDraft } from "@fitr8/contracts";

export interface MealContext {
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  dietType: "VEG" | "NON_VEG" | "EGGETARIAN" | "VEGAN";
  region?: string;
  frequentFoods?: string[];
  /** The user's own details about this meal ("small cup, 2 sachets sugar"). Overrides guesses. */
  userNote?: string;
}

export interface ImageInput {
  data: Buffer;
  mediaType: string;
}

export interface AiUsage {
  provider: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
}

export interface AiResult<T> {
  data: T;
  usage: AiUsage;
}

/**
 * Structured extraction: images/text → validated JSON. Callers never see provider types, so the model
 * or vendor can change (or move to a separate inference service) without touching meal logic.
 */
export interface FoodExtractor {
  readonly name: string;
  analyzeMealPhoto(input: {
    image: ImageInput;
    context: MealContext;
  }): Promise<AiResult<MealAnalysis>>;
  parseMealText(input: { text: string; context: MealContext }): Promise<AiResult<MealAnalysis>>;
  readNutritionLabel(input: { image: ImageInput }): Promise<AiResult<LabelRead>>;
  /** Small text task on the same port: "remind me to take creatine at 9 am" → title, line and cron. */
  parseReminder(input: ReminderRequest): Promise<AiResult<ReminderDraft>>;
}

export interface ReminderRequest {
  text: string;
  /** The user's local date and time, e.g. "Monday 16 November 2026, 11:10 pm", for "tonight" / "tomorrow". */
  localNow: string;
}

export const FOOD_EXTRACTOR = Symbol("FOOD_EXTRACTOR");
