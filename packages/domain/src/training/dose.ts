import type { Experience, Phase } from "./types.js";

/** Spec §2: deficit below TDEE × 0.95, surplus above TDEE × 1.03, else maintenance. */
export function caloriePhase(targetKcal: number, tdee: number): Phase {
  if (targetKcal < tdee * 0.95) return "deficit";
  if (targetKcal > tdee * 1.03) return "surplus";
  return "maintenance";
}

/** How far below maintenance the target is, as a fraction (0.19 = 19 % deficit). */
export const deficitFraction = (targetKcal: number, tdee: number) =>
  Math.max(0, (tdee - targetKcal) / tdee);

export interface Dose {
  /** Weekly hard sets per muscle the plan aims for. */
  weeklySets: [number, number];
  main: { sets: number; reps: [number, number]; rir: number };
  secondary: { sets: number; reps: [number, number]; rir: number };
  accessory: { sets: number; reps: [number, number]; rir: number };
  cardio: string;
  deloadEvery: number;
  /** Big deficit: trim one accessory per session to sit at the low end of volume. */
  lowVolume: boolean;
}

/**
 * Spec §2 table. Beginners (and anyone we won't put in a deficit) get the low end of volume,
 * 3 × 8–10 main lifts and 2–3 reps in reserve.
 */
export function doseFor(phase: Phase, deficit: number, experience: Experience): Dose {
  if (experience === "BEGINNER") {
    return {
      weeklySets: [10, 12],
      main: { sets: 3, reps: [8, 10], rir: 3 },
      secondary: { sets: 3, reps: [8, 10], rir: 3 },
      accessory: { sets: 2, reps: [10, 12], rir: 3 },
      cardio: phaseCardio(phase),
      deloadEvery: 6,
      lowVolume: phase === "deficit" && deficit > 0.2,
    };
  }
  if (phase === "deficit") {
    return {
      weeklySets: deficit > 0.2 ? [10, 10] : [10, 12],
      main: { sets: 3, reps: [5, 8], rir: 2 },
      secondary: { sets: 3, reps: [8, 10], rir: 2 },
      accessory: { sets: 2, reps: [8, 15], rir: 2 },
      cardio: phaseCardio(phase),
      deloadEvery: 6,
      lowVolume: deficit > 0.2,
    };
  }
  if (phase === "surplus") {
    return {
      weeklySets: [14, 20],
      main: { sets: 4, reps: [6, 10], rir: 2 },
      secondary: { sets: 3, reps: [8, 10], rir: 2 },
      accessory: { sets: 3, reps: [10, 15], rir: 1 },
      cardio: phaseCardio(phase),
      deloadEvery: 8,
      lowVolume: false,
    };
  }
  return {
    weeklySets: [12, 16],
    main: { sets: 3, reps: [6, 10], rir: 2 },
    secondary: { sets: 3, reps: [8, 10], rir: 2 },
    accessory: { sets: 2, reps: [8, 15], rir: 2 },
    cardio: phaseCardio(phase),
    deloadEvery: 8,
    lowVolume: false,
  };
}

function phaseCardio(phase: Phase): string {
  return phase === "deficit"
    ? "Zone 2 walk or cycle 20–25 min on 2–3 rest days, plus 8–10k steps. No extra HIIT."
    : "Zone 2 walk or cycle 20 min, twice a week.";
}

/** Deload on every Nth week of the plan (week index is 0-based). */
export const isDeloadWeek = (weekIndex: number, every: number) =>
  weekIndex > 0 && (weekIndex + 1) % every === 0;
