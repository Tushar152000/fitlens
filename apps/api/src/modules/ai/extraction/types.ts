import type { LabelRead, MealAnalysis } from "@fitlens/contracts";

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
}

export const FOOD_EXTRACTOR = Symbol("FOOD_EXTRACTOR");
