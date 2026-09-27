import type { ExerciseDef, ExerciseSession, Experience, Phase, Prescription } from "./types";

const EMPTY_BAR_KG = 20;

/** Round down to the exercise's load step (never below one step). */
export function roundToStep(kg: number, step: number): number {
  if (step <= 0) return Math.round(kg);
  return Math.max(step, Math.floor(kg / step) * step);
}

/**
 * Spec §6 first session: a conservative start, calibrated over the first two sessions.
 * Intermediate = startRatio × bodyweight (bench ≈ 50 %); beginners start with an empty bar or
 * light dumbbells; advanced lifters a little heavier. Bodyweight moves have no load.
 */
export function startingLoad(
  ex: ExerciseDef,
  bodyweightKg: number,
  experience: Experience,
): number | null {
  if (ex.load === "bodyweight" || !ex.startRatio) return null;
  if (experience === "BEGINNER" && ex.load === "barbell") return EMPTY_BAR_KG;
  const factor = experience === "BEGINNER" ? 0.6 : experience === "ADVANCED" ? 1.2 : 1;
  const kg = ex.startRatio * bodyweightKg * factor;
  return ex.load === "barbell"
    ? Math.max(EMPTY_BAR_KG, roundToStep(kg, ex.loadStepKg))
    : roundToStep(kg, ex.loadStepKg);
}

const missedBottom = (s: ExerciseSession) => s.sets.some((set) => set.reps < s.rx.repMin);
const hitTop = (s: ExerciseSession) =>
  s.sets.length >= s.rx.sets &&
  s.sets.every((set) => set.reps >= s.rx.repMax && (set.rir == null || set.rir >= s.rx.rir));

export interface NextTarget {
  targetKg: number | null;
  /** Sets to drop for the next week (0 or −1). */
  setsDelta: number;
  status: "start" | "increase" | "hold" | "drop_set" | "reduce";
  note: string;
}

/**
 * Spec §6 double progression. `history` is newest first.
 * - Top of the range on every set at the target effort → + loadStepKg, reps back to the bottom.
 * - Missed the bottom 2 sessions running → keep the load, one fewer set for a week.
 * - 3 misses running → load −5 %, except in a deficit, where holding the load is the win.
 */
export function nextTarget(
  ex: ExerciseDef,
  history: ExerciseSession[],
  phase: Phase,
  fallbackKg: number | null,
): NextTarget {
  const last = history[0];
  if (!last) {
    return {
      targetKg: fallbackKg,
      setsDelta: 0,
      status: "start",
      note:
        fallbackKg == null
          ? "First time — pick a version you can do with 2 reps to spare."
          : "First time: a conservative start. We'll calibrate over your first two sessions.",
    };
  }

  const kg = last.rx.targetKg ?? maxKg(last);
  if (hitTop(last)) {
    if (kg == null || ex.loadStepKg === 0) {
      return {
        targetKg: kg,
        setsDelta: 0,
        status: "increase",
        note: `You hit ${last.rx.repMax} on every set — make it harder (slower, pause, or a harder version).`,
      };
    }
    return {
      targetKg: kg + ex.loadStepKg,
      setsDelta: 0,
      status: "increase",
      note: `You hit ${last.rx.repMax} reps on every set — up ${ex.loadStepKg} kg, reps back to ${last.rx.repMin}.`,
    };
  }

  let misses = 0;
  for (const s of history) {
    if (!missedBottom(s)) break;
    misses++;
  }

  if (misses >= 3 && phase !== "deficit" && kg != null && ex.loadStepKg > 0) {
    return {
      targetKg: Math.max(ex.loadStepKg, Math.round((kg * 0.95) / ex.loadStepKg) * ex.loadStepKg),
      setsDelta: 0,
      status: "reduce",
      note: `Missed ${last.rx.repMin} reps three sessions running — load down 5 % to rebuild.`,
    };
  }
  if (misses >= 2) {
    return {
      targetKg: kg,
      setsDelta: -1,
      status: "drop_set",
      note:
        phase === "deficit"
          ? "Reps stalled in a deficit — same load, one fewer set this week. Holding the load is the win."
          : `Missed ${last.rx.repMin} reps twice — same load, one fewer set this week.`,
    };
  }
  return {
    targetKg: kg,
    setsDelta: 0,
    status: "hold",
    note:
      phase === "deficit"
        ? "Same load — aim for one more rep than last time. In a deficit, holding the load is the win."
        : "Same load — aim for one more rep than last time.",
  };
}

function maxKg(s: ExerciseSession): number | null {
  const loads = s.sets.map((x) => x.kg).filter((k): k is number => k != null);
  return loads.length ? Math.max(...loads) : null;
}

/** Target reps shown for the next session after a result, e.g. for the log response. */
export function repsAfter(
  status: NextTarget["status"],
  rx: Pick<Prescription, "repMin" | "repMax">,
) {
  return status === "increase" ? rx.repMin : rx.repMax;
}
