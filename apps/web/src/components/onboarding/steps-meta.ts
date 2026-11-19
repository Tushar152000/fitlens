/**
 * Which steps the rail shows. Everyone signs in first (/login), so onboarding is always signed in:
 * "new" = not onboarded yet, "edit" = changing the goal from Profile.
 */
export type OnboardingMode = "new" | "edit";

export const RAIL: Record<OnboardingMode, readonly string[]> = {
  new: ["Your details", "Your goal", "About you", "Your daily target", "Get the app"],
  edit: ["Your goal", "About you", "Your daily target"],
};

/** Steps that are part of the form (the rest are the plan and get-the-app screens). */
export const SETUP_STEPS: Record<OnboardingMode, number> = { new: 3, edit: 2 };

/** `?flow=` on /onboarding/plan and /onboarding/app; anything else is an edit. */
export const parseMode = (v: unknown): OnboardingMode =>
  v === "new" || v === "welcome" ? "new" : "edit";

export const dateLabel = (ymd: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ymd));

const GOAL_LABEL = {
  FAT_LOSS: "Lose fat",
  MUSCLE_GAIN: "Build muscle",
  RECOMPOSITION: "Recomposition",
};

/** "Lose fat · 74 kg by 2 Feb 2027", or the preview wording before the goal is set. */
export function estimateLine(e: {
  goalType: keyof typeof GOAL_LABEL;
  exact: boolean;
  targetWeightKg: number;
  targetDate?: string;
}) {
  const goal = GOAL_LABEL[e.goalType];
  if (!e.exact || !e.targetDate) return `${goal} · estimate until you set a target`;
  const weight =
    e.goalType === "RECOMPOSITION" ? "" : ` · ${Math.round(e.targetWeightKg * 10) / 10} kg`;
  return `${goal}${weight} by ${dateLabel(e.targetDate)}`;
}
