import type { Slot } from "./types";

export interface DayTemplate {
  name: string;
  /** Ordered slots; the first is the main lift, the second a secondary compound. */
  slots: Slot[];
  /** Added only for longer sessions (60+ min). */
  extras: Slot[];
  /** Which option to take in each slot: A days 0, B days 1 (falls back to 0). */
  variant: number;
}

const FULL_A: DayTemplate = {
  name: "Full body A",
  slots: ["squat", "horizontal_push", "horizontal_pull", "hinge", "vertical_push", "core"],
  extras: ["vertical_pull", "single_leg"],
  variant: 0,
};
const UPPER: Omit<DayTemplate, "name" | "variant"> = {
  slots: [
    "horizontal_push",
    "horizontal_pull",
    "vertical_push",
    "vertical_pull",
    "lateral_delt",
    "arms",
  ],
  extras: ["rear_delt", "core"],
};
const LOWER: Omit<DayTemplate, "name" | "variant"> = {
  slots: ["squat", "hinge", "single_leg", "leg_curl", "calves", "core"],
  extras: ["hinge", "core"],
};
const PUSH: Omit<DayTemplate, "name" | "variant"> = {
  slots: ["horizontal_push", "incline_push", "vertical_push", "lateral_delt", "triceps"],
  extras: ["core", "triceps"],
};
const PULL: Omit<DayTemplate, "name" | "variant"> = {
  slots: ["vertical_pull", "horizontal_pull", "rear_delt", "biceps", "biceps"],
  extras: ["core", "hinge"],
};
const LEGS: Omit<DayTemplate, "name" | "variant"> = {
  slots: ["squat", "hinge", "single_leg", "leg_curl", "calves", "core"],
  extras: ["hinge", "core"],
};

/** Training weekdays (0 = Monday) for 2–6 days a week. */
const WEEKDAYS: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

export interface Split {
  name: string;
  weekdays: number[];
  days: DayTemplate[];
}

/** Spec §3: 2–3 days full body A/B, 4 upper/lower ×2, 5–6 push/pull/legs. */
export function splitFor(daysPerWeek: number, forceFullBody = false): Split {
  const n = Math.min(6, Math.max(2, Math.round(daysPerWeek)));
  const fullB = { ...FULL_A, name: "Full body B", variant: 1 };
  if (forceFullBody || n <= 3) {
    const days = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? FULL_A : fullB));
    return { name: "Full body A/B", weekdays: WEEKDAYS[n], days };
  }
  if (n === 4) {
    return {
      name: "Upper / lower",
      weekdays: WEEKDAYS[4],
      days: [
        { ...UPPER, name: "Upper A", variant: 0 },
        { ...LOWER, name: "Lower A", variant: 0 },
        { ...UPPER, name: "Upper B", variant: 1 },
        { ...LOWER, name: "Lower B", variant: 1 },
      ],
    };
  }
  const ppl = [
    { ...PUSH, name: "Push A", variant: 0 },
    { ...PULL, name: "Pull A", variant: 0 },
    { ...LEGS, name: "Legs A", variant: 0 },
    { ...PUSH, name: "Push B", variant: 1 },
    { ...PULL, name: "Pull B", variant: 1 },
    { ...LEGS, name: "Legs B", variant: 1 },
  ];
  return { name: "Push / pull / legs", weekdays: WEEKDAYS[n], days: ppl.slice(0, n) };
}

/** Spec §3: 30 min → 4 exercises, 45 → 6, 60 → 7, longer → 8. */
export function exercisesFor(sessionMinutes: number): number {
  if (sessionMinutes <= 30) return 4;
  if (sessionMinutes <= 45) return 6;
  if (sessionMinutes <= 60) return 7;
  return 8;
}

/** Spec §3 rest: main lifts 2–3 min, accessories 60–90 s. */
export const REST_SEC = { main: 150, secondary: 120, accessory: 75 } as const;
