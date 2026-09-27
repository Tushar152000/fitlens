import { describe, expect, it } from "vitest";
import {
  adjustSession,
  buildWeek,
  caloriePhase,
  doseFor,
  EXERCISE_BY_SLUG,
  exercisesFor,
  fuelStatus,
  fuelTrainingDays,
  isDeloadWeek,
  nextTarget,
  optionsFor,
  pickSnack,
  reviewTraining,
  splitFor,
  startingLoad,
  type Equipment,
  type ExerciseSession,
  type PlanInput,
  type Slot,
} from ".";

const monday = new Date("2026-09-28T00:00:00Z");
const TDEE = 2790;

/** The spec's worked example: 82 kg, fat loss, 4 days, gym, 45 min, 19 % deficit. */
const example: PlanInput = {
  weekStart: monday,
  weekIndex: 0,
  experience: "INTERMEDIATE",
  equipment: "FULL_GYM",
  daysPerWeek: 4,
  sessionMinutes: 45,
  injuries: [],
  medicalFlag: false,
  ageYears: 27,
  bodyweightKg: 82,
  targetKcal: Math.round(TDEE * 0.81),
  tdee: TDEE,
};

describe("calorie phase and dose (§2)", () => {
  it("classifies deficit, maintenance and surplus", () => {
    expect(caloriePhase(2000, 2500)).toBe("deficit");
    expect(caloriePhase(2400, 2500)).toBe("maintenance");
    expect(caloriePhase(2575, 2500)).toBe("maintenance");
    expect(caloriePhase(2600, 2500)).toBe("surplus");
  });

  it("uses the deficit table and trims volume past a 20 % deficit", () => {
    const d = doseFor("deficit", 0.19, "INTERMEDIATE");
    expect(d.main).toEqual({ sets: 3, reps: [5, 8], rir: 2 });
    expect(d.accessory.sets).toBe(2);
    expect(d.deloadEvery).toBe(6);
    expect(d.lowVolume).toBe(false);
    expect(doseFor("deficit", 0.22, "INTERMEDIATE").weeklySets).toEqual([10, 10]);
    expect(doseFor("deficit", 0.22, "INTERMEDIATE").lowVolume).toBe(true);
  });

  it("gives beginners 3 × 8–10 at 2–3 reps in reserve", () => {
    const d = doseFor("surplus", 0, "BEGINNER");
    expect(d.main).toEqual({ sets: 3, reps: [8, 10], rir: 3 });
    expect(d.accessory.reps).toEqual([10, 12]);
  });

  it("deloads every 6th week in a deficit, 8th otherwise", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((w) => isDeloadWeek(w, 6))).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(isDeloadWeek(7, 8)).toBe(true);
  });
});

describe("split and slots (§3)", () => {
  it("picks full body for 2–3 days, upper/lower for 4, PPL for 5–6", () => {
    expect(splitFor(3).days.map((d) => d.name)).toEqual([
      "Full body A",
      "Full body B",
      "Full body A",
    ]);
    expect(splitFor(4).days.map((d) => d.name)).toEqual([
      "Upper A",
      "Lower A",
      "Upper B",
      "Lower B",
    ]);
    expect(splitFor(4).weekdays).toEqual([0, 1, 3, 4]);
    expect(splitFor(5).days.map((d) => d.name)).toEqual([
      "Push A",
      "Pull A",
      "Legs A",
      "Push B",
      "Pull B",
    ]);
  });

  it("sizes sessions by length", () => {
    expect([30, 45, 60, 90].map(exercisesFor)).toEqual([4, 6, 7, 8]);
  });
});

describe("exercise library (§4)", () => {
  const slots: Slot[] = [
    "horizontal_push",
    "horizontal_pull",
    "squat",
    "hinge",
    "vertical_push",
    "vertical_pull",
    "incline_push",
    "lateral_delt",
    "rear_delt",
    "biceps",
    "triceps",
    "arms",
    "single_leg",
    "leg_curl",
    "calves",
    "core",
  ];
  const levels: Equipment[] = ["FULL_GYM", "DUMBBELLS", "BODYWEIGHT"];

  it("has about 60 exercises with unique slugs", () => {
    expect(EXERCISE_BY_SLUG.size).toBeGreaterThanOrEqual(55);
  });

  it("has at least one option per slot and equipment level", () => {
    for (const slot of slots)
      for (const eq of levels)
        expect(optionsFor(slot, eq, []).length, `${slot} / ${eq}`).toBeGreaterThan(0);
  });

  it("follows the spec's per-equipment table", () => {
    expect(optionsFor("horizontal_push", "FULL_GYM", [])[0].slug).toBe("barbell-bench-press");
    expect(optionsFor("horizontal_pull", "DUMBBELLS", [])[0].slug).toBe("dumbbell-row");
    expect(optionsFor("vertical_push", "BODYWEIGHT", [])[0].slug).toBe("pike-push-up");
  });

  it("filters injuries and falls to the next option", () => {
    const hinge = optionsFor("hinge", "FULL_GYM", ["Lower back pain"]);
    expect(hinge.map((e) => e.slug)).not.toContain("romanian-deadlift");
    expect(hinge[0].slug).toBe("barbell-hip-thrust");
  });
});

describe("loads and progression (§6)", () => {
  const bench = EXERCISE_BY_SLUG.get("barbell-bench-press")!;
  const session = (
    reps: number[],
    rx = { sets: 3, repMin: 6, repMax: 8, rir: 2, targetKg: 60 },
  ): ExerciseSession => ({
    date: "2026-09-21",
    sets: reps.map((r) => ({ kg: rx.targetKg, reps: r, rir: 2 })),
    rx,
  });

  it("starts conservatively: ~50 % of bodyweight on bench, empty bar for beginners", () => {
    expect(startingLoad(bench, 82, "INTERMEDIATE")).toBe(40);
    expect(startingLoad(bench, 82, "BEGINNER")).toBe(20);
    expect(startingLoad(EXERCISE_BY_SLUG.get("push-up")!, 82, "INTERMEDIATE")).toBeNull();
  });

  it("adds a load step after topping the range on every set", () => {
    const t = nextTarget(bench, [session([8, 8, 8])], "deficit", 40);
    expect(t).toMatchObject({ targetKg: 62.5, status: "increase", setsDelta: 0 });
  });

  it("holds the load when reps land inside the range", () => {
    expect(nextTarget(bench, [session([8, 7, 6])], "maintenance", 40)).toMatchObject({
      targetKg: 60,
      status: "hold",
    });
  });

  it("drops a set after two misses and the load 5 % after three", () => {
    const miss = session([6, 5, 4]);
    expect(nextTarget(bench, [miss, miss], "maintenance", 40)).toMatchObject({
      targetKg: 60,
      setsDelta: -1,
    });
    expect(nextTarget(bench, [miss, miss, miss], "maintenance", 40)).toMatchObject({
      targetKg: 57.5,
      status: "reduce",
    });
  });

  it("never lowers the load in a deficit", () => {
    const miss = session([6, 5, 4]);
    const t = nextTarget(bench, [miss, miss, miss], "deficit", 40);
    expect(t.targetKg).toBe(60);
    expect(t.status).toBe("drop_set");
    expect(t.note).toMatch(/holding the load is the win/i);
  });
});

describe("buildWeek", () => {
  it("builds the spec's 4-day example", () => {
    const week = buildWeek(example);
    expect(week.phase).toBe("deficit");
    expect(week.deficitPct).toBe(19);
    expect(week.days.map((d) => [d.date, d.name])).toEqual([
      ["2026-09-28", "Upper A"],
      ["2026-09-29", "Lower A"],
      ["2026-10-01", "Upper B"],
      ["2026-10-02", "Lower B"],
    ]);
    const [upperA, lowerA] = week.days;
    expect(upperA.exercises).toHaveLength(6);
    expect(upperA.exercises[0]).toMatchObject({
      slug: "barbell-bench-press",
      sets: 3,
      repMin: 6,
      repMax: 8,
      rir: 2,
      targetKg: 40,
    });
    expect(upperA.exercises[1]).toMatchObject({
      slug: "chest-supported-row",
      sets: 3,
      repMin: 8,
      repMax: 10,
    });
    expect(upperA.exercises.slice(2).every((e) => e.sets === 2)).toBe(true);
    expect(lowerA.exercises[0]).toMatchObject({ slug: "barbell-back-squat", repMin: 5, repMax: 8 });
    expect(lowerA.exercises.find((e) => e.slug === "plank")).toMatchObject({
      sets: 3,
      repMin: 30,
      repMax: 45,
      timed: true,
    });
    expect(week.days[2].exercises[0].slug).not.toBe(upperA.exercises[0].slug); // B day varies
  });

  it("drops an accessory in a deficit over 20 %", () => {
    const week = buildWeek({ ...example, targetKcal: Math.round(TDEE * 0.75) });
    expect(week.days[0].exercises).toHaveLength(5);
    expect(week.notes.join(" ")).toMatch(/one fewer accessory/);
  });

  it("halves sets and cuts loads 10 % on a deload week", () => {
    const week = buildWeek({ ...example, weekIndex: 5 });
    expect(week.deload).toBe(true);
    expect(week.days[0].exercises[0]).toMatchObject({ sets: 2, targetKg: 35 });
  });

  it("uses history for the next target", () => {
    const history = {
      "barbell-bench-press": [
        {
          date: "2026-09-21",
          sets: [8, 8, 8].map((reps) => ({ kg: 60, reps })),
          rx: { sets: 3, repMin: 6, repMax: 8, rir: 2, targetKg: 60 },
        },
      ],
    };
    const bench = buildWeek({ ...example, history }).days[0].exercises[0];
    expect(bench.targetKg).toBe(62.5);
    expect(bench.note).toMatch(/up 2.5 kg/);
  });

  it("keeps under-18s and medical flags on easy full body", () => {
    const week = buildWeek({ ...example, medicalFlag: true });
    expect(week.phase).toBe("maintenance");
    expect(week.split).toBe("Full body A/B");
    expect(week.days.every((d) => d.exercises.every((e) => e.rir >= 3))).toBe(true);
    expect(week.notes[0]).toMatch(/check with a professional/);
  });

  it("works around injuries", () => {
    const week = buildWeek({ ...example, injuries: ["knee"], equipment: "BODYWEIGHT" });
    const lower = week.days[1].exercises.map((e) => e.slug);
    expect(lower).not.toContain("bodyweight-squat");
    expect(lower).not.toContain("reverse-lunge");
    expect(week.notes.join(" ")).toMatch(/Skipped squat/);
  });
});

describe("daily adjustments (§7)", () => {
  const day = buildWeek(example).days[0];
  const base = {
    phase: "deficit" as const,
    deficitPct: 19,
    deload: false,
    yesterdayIntakeRatio: 0.9,
    restricted: false,
  };

  it("trims accessories and adds a rep in reserve when tired", () => {
    const s = adjustSession(day, { ...base, energy: "tired" });
    expect(s.exercises[0].sets).toBe(3);
    expect(s.exercises.slice(2).every((e) => e.sets === 1 && e.plannedSets === 2)).toBe(true);
    expect(s.exercises.every((e, i) => e.rir === day.exercises[i].rir + 1)).toBe(true);
    expect(s.trimmed).toBe(true);
    expect(s.rules.some((r) => /tired/.test(r.reason))).toBe(true);
  });

  it("treats a low-intake yesterday like tired", () => {
    const s = adjustSession(day, { ...base, energy: "great", yesterdayIntakeRatio: 0.6 });
    expect(s.trimmed).toBe(true);
    expect(s.rules.some((r) => /60%/.test(r.reason))).toBe(true);
  });

  it("allows a bonus rep but no extra sets when great in a deficit", () => {
    const s = adjustSession(day, { ...base, energy: "great" });
    expect(s.exercises[0].bonusRep).toBe(true);
    expect(s.exercises.every((e) => e.sets === e.plannedSets)).toBe(true);
    const surplus = adjustSession(day, { ...base, phase: "surplus", energy: "great" });
    expect(surplus.exercises[2].sets).toBe(3);
  });

  it("always explains at least two rules when the dose is known", () => {
    const s = adjustSession(day, { ...base, energy: "ok", weeklySets: [10, 12] });
    expect(s.rules.length).toBeGreaterThanOrEqual(2);
    expect(s.rules.length).toBeLessThanOrEqual(3);
    expect(s.rules.some((r) => /10–12 hard sets/.test(r.title))).toBe(true);
  });

  it("flags low fuel and picks a snack near 20 g protein / 35 g carbs", () => {
    expect(fuelStatus(400, 2200).low).toBe(true);
    expect(fuelStatus(800, 2200).low).toBe(false);
    const pick = pickSnack([
      { id: "a", name: "Banana", kcal: 105, proteinG: 1, carbsG: 27 },
      { id: "b", name: "Milk + banana", kcal: 250, proteinG: 9, carbsG: 39 },
      { id: "c", name: "Curd + banana + eggs", kcal: 330, proteinG: 21, carbsG: 34 },
    ]);
    expect(pick?.id).toBe("c");
  });
});

describe("fuel follows training (§8) and check-in hooks (§9)", () => {
  it("matches the spec example: 2,260/day with 4 training days", () => {
    expect(fuelTrainingDays(2260, 4)).toEqual({
      trainingKcal: 2340,
      restKcal: 2153,
      trainingCarbDeltaG: 20,
      restCarbDeltaG: -27,
    });
  });

  it("reduces days, fixes food, or deloads from weekly signals", () => {
    const actions = reviewTraining({
      phase: "deficit",
      daysPerWeek: 4,
      sessionMinutes: 45,
      adherence: [0.25, 0.4],
      weightStalledWeeks: 2,
      mainLiftMissWeeks: 2,
    });
    expect(actions.map((a) => a.type)).toEqual(["fewer_days", "food_or_steps", "deload_next_week"]);
    expect(actions[1].message).toMatch(/not add training volume/);
  });
});
