import type { ActivityLevel, GoalType, Sex } from "@fitr8/domain/nutrition";
import type { OnboardingDraft } from "./draft";

/**
 * Answers given before sign-in, carried across the Google round trip in sessionStorage (this tab
 * only). /welcome/done turns them into POST /api/onboarding once there's a session.
 */
export const PENDING_KEY = "fitr8.onboarding.pending";
/** What the visitor typed into the landing-page calculator, to prefill onboarding. */
export const CALCULATOR_KEY = "fitr8.onboarding.calculator";

export interface PendingOnboarding {
  name: string;
  draft: OnboardingDraft;
}

export interface CalculatorNumbers {
  goal: GoalType;
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode): the answers are simply asked again after sign-in.
  }
}

function read<T>(key: string, remove: boolean): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (remove) sessionStorage.removeItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const stashPending = (p: PendingOnboarding) => write(PENDING_KEY, p);
/** Reads and clears: the answers are used once. */
export const takePending = () => read<PendingOnboarding>(PENDING_KEY, true);

export const stashCalculator = (c: CalculatorNumbers) => write(CALCULATOR_KEY, c);

/** Parses the raw calculator entry; anything malformed is ignored. */
export function parseCalculator(raw: string | null): CalculatorNumbers | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<CalculatorNumbers>;
    const ok =
      typeof c.goal === "string" &&
      (c.sex === "MALE" || c.sex === "FEMALE") &&
      typeof c.activity === "string" &&
      [c.ageYears, c.heightCm, c.weightKg].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      );
    return ok ? (c as CalculatorNumbers) : null;
  } catch {
    return null;
  }
}

/** The calculator numbers as draft fields (date of birth is unknown, only an age). */
export function draftFromCalculator(c: CalculatorNumbers): Partial<OnboardingDraft> {
  return {
    goalType: c.goal,
    sex: c.sex,
    heightCm: String(c.heightCm),
    weightKg: String(c.weightKg),
    activityLevel: c.activity,
  };
}

/** Parses a raw pending entry without clearing it (used to prefill after a failed save). */
export function parsePending(raw: string | null): PendingOnboarding | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingOnboarding;
    return p && typeof p === "object" && p.draft && typeof p.draft === "object" ? p : null;
  } catch {
    return null;
  }
}
