import type { Energy, Phase, PlanDay, Prescription } from "./types.js";

export interface AdjustedExercise extends Prescription {
  /** Sets in the plan before today's adjustment (shown struck through / green when trimmed). */
  plannedSets: number;
  /** +1 rep allowed on the last set (energy = great, main lift). */
  bonusRep: boolean;
}

export interface CoachRule {
  title: string;
  reason: string;
}

export interface AdjustedSession {
  name: string;
  date: string;
  exercises: AdjustedExercise[];
  trimmed: boolean;
  estimatedMinutes: number;
  rules: CoachRule[];
}

export interface DayContext {
  energy: Energy;
  phase: Phase;
  deficitPct: number;
  deload: boolean;
  /** Yesterday's confirmed kcal ÷ yesterday's target (null if unknown). */
  yesterdayIntakeRatio: number | null;
  restricted: boolean;
  /** Weekly hard sets per muscle from the dose (for the volume rule). */
  weeklySets?: [number, number];
}

/** Rough minutes: 45 s per set plus prescribed rest, plus 5 min warm-up. */
export function estimateMinutes(exercises: Pick<Prescription, "sets" | "restSec">[]): number {
  const sec = exercises.reduce((t, e) => t + e.sets * (45 + e.restSec), 0);
  return Math.round(sec / 60 + 5);
}

/**
 * Spec §7 daily adjustments (this session only).
 * - Tired, or yesterday < 70 % of target → keep main lifts, drop the last set of every accessory,
 *   +1 rep in reserve everywhere, ≈ 20 % shorter.
 * - Great → +1 rep on the last main-lift set; in a surplus also +1 accessory set.
 */
export function adjustSession(day: PlanDay, ctx: DayContext): AdjustedSession {
  const underFed = ctx.yesterdayIntakeRatio != null && ctx.yesterdayIntakeRatio < 0.7;
  const easy = ctx.energy === "tired" || underFed;
  const great = ctx.energy === "great" && !underFed;

  const exercises: AdjustedExercise[] = day.exercises.map((e) => {
    const out: AdjustedExercise = { ...e, plannedSets: e.sets, bonusRep: false };
    if (easy) {
      if (e.role === "accessory") out.sets = Math.max(1, e.sets - 1);
      out.rir = Math.min(5, e.rir + 1);
    } else if (great) {
      if (e.role === "main") out.bonusRep = true;
      if (ctx.phase === "surplus" && e.role === "accessory") out.sets = e.sets + 1;
    }
    return out;
  });

  const rules: CoachRule[] = [];
  if (ctx.restricted) {
    rules.push({
      title: "Easy effort, full body",
      reason:
        "No deficit training for under-18s or a medical flag. Check with a professional before pushing harder.",
    });
  } else if (ctx.deload) {
    rules.push({
      title: "Deload: half the sets, 10 % lighter",
      reason: "Planned recovery week so the next block moves up.",
    });
  } else if (ctx.phase === "deficit") {
    rules.push({
      title: "Keep the load, chase the reps",
      reason: `You're eating ${ctx.deficitPct}% under maintenance, so holding strength is the win. We never drop weight just for the deficit.`,
    });
  } else if (ctx.phase === "surplus") {
    rules.push({
      title: "Push the accessories",
      reason:
        "You're in a surplus, so there's fuel for more volume: accessories go close to failure (0–2 reps left).",
    });
  } else {
    rules.push({
      title: "Build a little each week",
      reason: "At maintenance, add a rep or a small load step whenever you top the rep range.",
    });
  }

  if (easy) {
    rules.push({
      title: "Last accessory set trimmed, 1 more rep in reserve",
      reason: underFed
        ? `You ate ${Math.round((ctx.yesterdayIntakeRatio ?? 0) * 100)}% of your target yesterday, so today is a bit lighter. Main lifts stay.`
        : "You're feeling tired, so today is about 20% shorter. Main lifts stay.",
    });
  } else if (great) {
    rules.push({
      title: "One bonus rep on your last main set",
      reason:
        ctx.phase === "surplus"
          ? "Feeling great and fuelled: +1 rep on the last main set and one extra accessory set."
          : "Feeling great: take +1 rep on the last main set. No extra sets in a deficit.",
    });
  }

  const progress = day.exercises.find((e) => e.role === "main" && e.note);
  if (progress?.note) rules.push({ title: progress.name, reason: progress.note });

  if (ctx.weeklySets && !ctx.restricted && !ctx.deload) {
    const [lo, hi] = ctx.weeklySets;
    rules.push({
      title: `${lo === hi ? lo : `${lo}–${hi}`} hard sets per muscle this week`,
      reason:
        ctx.phase === "deficit"
          ? "Enough to keep your muscle while you lose fat, without draining recovery."
          : ctx.phase === "surplus"
            ? "You're eating enough to grow, so volume sits high."
            : "Steady volume while your weight holds.",
    });
  }

  const planned = estimateMinutes(day.exercises);
  return {
    name: day.name,
    date: day.date,
    exercises,
    trimmed: exercises.some((e) => e.sets < e.plannedSets),
    estimatedMinutes: easy ? Math.round(planned * 0.8) : estimateMinutes(exercises),
    rules: rules.slice(0, 3),
  };
}

/** Spec §7: show the pre-workout snack card when under 30 % of today's target is eaten. */
export function fuelStatus(eatenKcal: number, targetKcal: number) {
  const ratio = targetKcal > 0 ? eatenKcal / targetKcal : 0;
  return { ratio, low: ratio < 0.3 };
}

export interface SnackOption {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  /** User's own usual (preferred on ties). */
  usual?: boolean;
}

/** Spec §7 pre-workout snack: ~20 g protein + 30–40 g carbs. Lowest distance wins; usuals win ties. */
export function pickSnack(options: SnackOption[]): SnackOption | null {
  const score = (o: SnackOption) =>
    Math.abs(o.proteinG - 20) / 20 + Math.abs(o.carbsG - 35) / 35 - (o.usual ? 0.15 : 0);
  const fit = options.filter((o) => o.kcal >= 120 && o.kcal <= 450);
  return fit.sort((a, b) => score(a) - score(b))[0] ?? null;
}
