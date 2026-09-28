import { caloriePhase, deficitFraction, doseFor, isDeloadWeek } from "./dose.js";
import { optionsFor } from "./library.js";
import { nextTarget, roundToStep, startingLoad } from "./progression.js";
import { exercisesFor, REST_SEC, splitFor } from "./split.js";
import {
  WeekPlanSchema,
  type Equipment,
  type ExerciseDef,
  type ExerciseSession,
  type Experience,
  type Prescription,
  type WeekPlan,
} from "./types.js";

export interface PlanInput {
  /** Monday of the week, UTC midnight. */
  weekStart: Date;
  /** 0-based count of plan weeks so far (drives deloads). */
  weekIndex: number;
  experience: Experience;
  equipment: Equipment;
  daysPerWeek: number;
  sessionMinutes: number;
  injuries: string[];
  medicalFlag: boolean;
  ageYears: number;
  bodyweightKg: number;
  targetKcal: number;
  tdee: number;
  /** Past sessions per exercise slug, newest first. */
  history?: Record<string, ExerciseSession[]>;
}

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Build one training week with deterministic rules (docs/DESIGN.md → Workout coach engine). */
export function buildWeek(input: PlanInput): WeekPlan {
  const restricted = input.medicalFlag || input.ageYears < 18;
  // §7: medical flag / under 18 → no deficit programming, beginner full body, RIR ≥ 3.
  const phase = restricted ? "maintenance" : caloriePhase(input.targetKcal, input.tdee);
  const deficit = restricted ? 0 : deficitFraction(input.targetKcal, input.tdee);
  const experience: Experience = restricted ? "BEGINNER" : input.experience;
  const dose = doseFor(phase, deficit, experience);
  const deload = isDeloadWeek(input.weekIndex, dose.deloadEvery);
  const split = splitFor(input.daysPerWeek, restricted);

  let count = exercisesFor(input.sessionMinutes);
  if (dose.lowVolume) count = Math.max(4, count - 1);

  const notes: string[] = [];
  const skipped = new Set<string>();

  const days = split.days.map((template, i) => {
    const date = ymd(new Date(input.weekStart.getTime() + split.weekdays[i] * DAY));
    const slots = [...template.slots, ...template.extras].slice(0, Math.max(count, 0));
    const used = new Set<string>();
    const exercises: Prescription[] = [];

    for (const slot of slots) {
      const options = optionsFor(slot, input.equipment, input.injuries).filter(
        (o) => !used.has(o.slug),
      );
      if (!options.length) {
        skipped.add(slot.replace("_", " "));
        continue;
      }
      // A/B days rotate through the slot's options; repeated slots take the next one.
      const ex = options[Math.min(template.variant, options.length - 1)];
      used.add(ex.slug);
      exercises.push(
        prescribe(
          ex,
          exercises.length === 0 ? "main" : exercises.length === 1 ? "secondary" : "accessory",
          {
            dose,
            phase,
            deload,
            input,
            experience,
            upper: template.slots[0] !== "squat",
          },
        ),
      );
    }
    return { date, name: template.name, exercises };
  });

  if (restricted) {
    notes.push(
      "Because of your age or a medical flag we keep this to beginner full-body training at easy effort. Please check with a professional before pushing harder.",
    );
  }
  if (deload)
    notes.push(
      "Deload week: same exercises, half the sets, loads down 10 %. Recover so next week moves up.",
    );
  if (dose.lowVolume)
    notes.push(
      "Big deficit, so one fewer accessory per session — enough to keep muscle without draining recovery.",
    );
  if (skipped.size)
    notes.push(
      `Skipped ${[...skipped].join(", ")} — nothing safe for your injuries with your equipment.`,
    );

  return WeekPlanSchema.parse({
    phase,
    split: split.name,
    deload,
    deficitPct: Math.round(deficit * 100),
    sessionMinutes: input.sessionMinutes,
    cardio: dose.cardio,
    notes,
    days,
  });
}

function prescribe(
  ex: ExerciseDef,
  role: Prescription["role"],
  ctx: {
    dose: ReturnType<typeof doseFor>;
    phase: WeekPlan["phase"];
    deload: boolean;
    input: PlanInput;
    experience: Experience;
    upper: boolean;
  },
): Prescription {
  const { dose, phase, deload, input, experience } = ctx;
  const tier = role === "main" ? dose.main : role === "secondary" ? dose.secondary : dose.accessory;

  let [repMin, repMax] = tier.reps;
  if (role === "main" && ctx.upper && experience !== "BEGINNER") repMin += 1; // upper main 6–8
  if (role === "accessory" && !ex.timed) {
    // Compound accessories sit low in the range, isolation high (8–12 vs 12–15).
    const isolation = [
      "lateral_delt",
      "rear_delt",
      "biceps",
      "triceps",
      "arms",
      "calves",
      "leg_curl",
    ].includes(ex.slot);
    if (isolation) repMin = Math.max(repMin, repMax - 3);
    else repMax = Math.min(repMax, repMin + 4);
  }
  let sets = tier.sets;
  if (ex.timed) {
    repMin = 30;
    repMax = 45;
    sets = Math.max(sets, 3);
  }

  const history = input.history?.[ex.slug] ?? [];
  const start = startingLoad(ex, input.bodyweightKg, experience);
  const next = nextTarget(ex, history, phase, start);
  let targetKg = next.targetKg;
  sets = Math.max(1, sets + next.setsDelta);

  if (deload) {
    sets = Math.max(1, Math.ceil(sets / 2));
    if (targetKg != null) targetKg = roundToStep(targetKg * 0.9, ex.loadStepKg || 1);
  }

  return {
    slug: ex.slug,
    name: ex.name,
    slot: ex.slot,
    role,
    sets,
    repMin,
    repMax,
    rir: tier.rir,
    restSec: REST_SEC[role],
    targetKg,
    timed: Boolean(ex.timed),
    note: next.status === "start" && history.length === 0 ? undefined : next.note,
  };
}
