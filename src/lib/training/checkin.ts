import type { Phase } from "./types";

export interface TrainingReviewInput {
  phase: Phase;
  daysPerWeek: number;
  sessionMinutes: number;
  /** Share of planned sessions done, most recent week first (e.g. [0.4, 0.3]). */
  adherence: number[];
  /** Consecutive weeks the weight trend hasn't moved toward the goal. */
  weightStalledWeeks: number;
  /** Consecutive weeks most main lifts missed their rep targets. */
  mainLiftMissWeeks: number;
}

export type TrainingAction =
  | { type: "fewer_days"; daysPerWeek: number; message: string }
  | { type: "shorter_session"; sessionMinutes: number; message: string }
  | { type: "food_or_steps"; message: string }
  | { type: "deload_next_week"; message: string };

/** Spec §9 weekly check-in hooks. */
export function reviewTraining(input: TrainingReviewInput): TrainingAction[] {
  const actions: TrainingAction[] = [];
  const [w1, w2] = input.adherence;

  if (w1 != null && w2 != null && w1 < 0.5 && w2 < 0.5) {
    if (input.daysPerWeek > 2) {
      actions.push({
        type: "fewer_days",
        daysPerWeek: input.daysPerWeek - 1,
        message: `You've done under half your sessions two weeks running, so we're moving to ${input.daysPerWeek - 1} days a week. Easier to keep, better results.`,
      });
    } else if (input.sessionMinutes > 30) {
      actions.push({
        type: "shorter_session",
        sessionMinutes: 30,
        message: "Under half your sessions two weeks running, so sessions are now 30 minutes.",
      });
    }
  }

  if (input.weightStalledWeeks >= 2) {
    actions.push({
      type: "food_or_steps",
      message:
        input.phase === "deficit"
          ? "Weight has stalled for two weeks: we'll adjust food or daily steps, not add training volume."
          : "Weight has stalled for two weeks: we'll adjust food or daily steps.",
    });
  }

  if (input.mainLiftMissWeeks >= 2) {
    actions.push({
      type: "deload_next_week",
      message: "Most main lifts missed their reps two weeks running, so next week is a deload.",
    });
  }
  return actions;
}
