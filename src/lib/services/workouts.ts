import { weekStart } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http-error";
import { ageFromBirthDate } from "@/lib/nutrition";
import {
  adjustSession,
  buildWeek,
  doseFor,
  EXERCISE_BY_SLUG,
  fuelStatus,
  nextTarget,
  pickSnack,
  WeekPlanSchema,
  type AdjustedSession,
  type Energy,
  type ExerciseSession,
  type PlanDay,
  type Prescription,
  type SetLog,
  type SnackOption,
  type WeekPlan,
} from "@/lib/training";
import type { Prisma } from "@/generated/prisma/client";
import { computePlan, currentTarget } from "./targets";
import { getUsuals } from "./usuals";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** What a WorkoutLog.sets JSON holds: the sets done and the prescription they were done against. */
interface StoredLog {
  sets: SetLog[];
  rx: Pick<Prescription, "sets" | "repMin" | "repMax" | "rir" | "targetKg">;
}

/** Past sessions per exercise (last 4 weeks), newest first — the engine's progression input. */
async function loadHistory(userId: string, before: Date) {
  const logs = await prisma.workoutLog.findMany({
    where: {
      userId,
      completed: true,
      date: { gte: new Date(before.getTime() - 28 * DAY), lt: before },
    },
    orderBy: { date: "desc" },
  });
  const history: Record<string, ExerciseSession[]> = {};
  for (const log of logs) {
    const stored = log.sets as unknown as StoredLog;
    if (!stored?.rx) continue;
    (history[log.exerciseSlug] ??= []).push({
      date: ymd(log.date),
      sets: stored.sets,
      rx: stored.rx,
    });
  }
  return history;
}

/** Everything the engine needs from the database for one week. */
async function planInputs(userId: string, monday: Date, today: Date) {
  const [{ plan, profile, metric }, target, pastWeeks, history] = await Promise.all([
    computePlan(userId),
    currentTarget(userId, today),
    prisma.workoutPlan.findMany({
      where: { userId, weekStart: { lt: monday } },
      distinct: ["weekStart"],
      select: { weekStart: true },
    }),
    loadHistory(userId, monday),
  ]);
  if (!target) throw new HttpError(409, "Finish onboarding first");
  return {
    weekStart: monday,
    weekIndex: pastWeeks.length,
    experience: profile.experience,
    equipment: profile.equipment,
    daysPerWeek: profile.trainingDaysPerWeek,
    sessionMinutes: profile.sessionMinutes,
    injuries: profile.injuries,
    medicalFlag: profile.medicalFlag,
    ageYears: ageFromBirthDate(profile.birthDate, today),
    bodyweightKg: metric.weightKg,
    targetKcal: target.kcal,
    tdee: plan.tdee,
    history,
  };
}

/** Build and save a new version of this week's plan (POST /api/workouts/generate). */
export async function generateWeek(userId: string, today: Date) {
  const monday = weekStart(today);
  const week = buildWeek(await planInputs(userId, monday, today));
  const latest = await prisma.workoutPlan.findFirst({
    where: { userId, weekStart: monday },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return prisma.workoutPlan.create({
    data: {
      userId,
      weekStart: monday,
      split: week.split,
      plan: WeekPlanSchema.parse(week) as unknown as Prisma.InputJsonValue,
      version: (latest?.version ?? 0) + 1,
    },
  });
}

/** This week's latest plan, generated on first use. */
export async function getOrCreateWeek(userId: string, today: Date) {
  const existing = await prisma.workoutPlan.findFirst({
    where: { userId, weekStart: weekStart(today) },
    orderBy: { version: "desc" },
  });
  const row = existing ?? (await generateWeek(userId, today));
  return { row, week: WeekPlanSchema.parse(row.plan) };
}

/** "before" is a training day that fell before this week's first plan existed, so not a miss. */
export type DayState = "done" | "today" | "planned" | "missed" | "before" | "rest";

/** Everything the Today card, 10a briefing and Workout screen need. */
export async function getTodayWorkout(userId: string, today: Date, energy: Energy = "ok") {
  const { row, week } = await getOrCreateWeek(userId, today);
  const todayKey = ymd(today);
  const yesterday = new Date(today.getTime() - DAY);

  const [logs, profile, target, targetYesterday, eatenToday, eatenYesterday] = await Promise.all([
    // By date, not plan id, so a regenerated plan still shows what's already done.
    prisma.workoutLog.findMany({
      where: {
        userId,
        completed: true,
        date: { gte: weekStart(today), lt: new Date(weekStart(today).getTime() + 7 * DAY) },
      },
      select: { date: true, exerciseSlug: true, sets: true },
    }),
    prisma.profile.findUnique({
      where: { userId },
      select: { medicalFlag: true, birthDate: true, dietType: true, experience: true },
    }),
    currentTarget(userId, today),
    currentTarget(userId, yesterday),
    confirmedKcal(userId, today),
    confirmedKcal(userId, yesterday),
  ]);

  const loggedByDate = new Map<string, Set<string>>();
  for (const l of logs) {
    const key = ymd(l.date);
    if (!loggedByDate.has(key)) loggedByDate.set(key, new Set());
    loggedByDate.get(key)!.add(l.exerciseSlug);
  }

  const monday = weekStart(today);
  const firstPlan = await prisma.workoutPlan.findFirst({
    where: { userId, weekStart: monday },
    orderBy: { version: "asc" },
    select: { createdAt: true },
  });
  const firstPlannedOn = ymd(firstPlan?.createdAt ?? row.createdAt);
  const strip = Array.from({ length: 7 }, (_, i) => {
    const date = ymd(new Date(monday.getTime() + i * DAY));
    const day = week.days.find((d) => d.date === date);
    const doneCount = loggedByDate.get(date)?.size ?? 0;
    let state: DayState = "rest";
    if (day) {
      if (doneCount >= day.exercises.length) state = "done";
      else if (date === todayKey) state = "today";
      else if (date < todayKey)
        state = doneCount > 0 ? "done" : date < firstPlannedOn ? "before" : "missed";
      else state = "planned";
    }
    return { date, name: day?.name ?? null, state };
  });

  const todayDay = week.days.find((d) => d.date === todayKey) ?? null;
  const nextDay = week.days.find((d) => d.date > todayKey) ?? null;
  const restricted = Boolean(
    profile && (profile.medicalFlag || ageFromBirthDate(profile.birthDate, today) < 18),
  );

  const session: AdjustedSession | null = todayDay
    ? adjustSession(todayDay, {
        energy,
        phase: week.phase,
        deficitPct: week.deficitPct,
        deload: week.deload,
        yesterdayIntakeRatio:
          targetYesterday && eatenYesterday > 0 ? eatenYesterday / targetYesterday.kcal : null,
        restricted,
        weeklySets: doseFor(week.phase, week.deficitPct / 100, profile?.experience ?? "BEGINNER")
          .weeklySets,
      })
    : null;

  const fuel = {
    ...fuelStatus(eatenToday, target?.kcal ?? 0),
    eatenKcal: Math.round(eatenToday),
    targetKcal: target?.kcal ?? 0,
  };
  // One snack nudge a day: once a snack is logged, stop suggesting another.
  const snackLogged = await prisma.mealLog.count({
    where: { userId, date: today, mealType: "SNACK", status: "CONFIRMED" },
  });
  const snack =
    todayDay && fuel.low && !snackLogged
      ? await snackFor(userId, profile?.dietType ?? "VEG")
      : null;

  return {
    planId: row.id,
    phase: week.phase,
    split: week.split,
    deload: week.deload,
    sessionMinutes: week.sessionMinutes,
    cardio: week.cardio,
    notes: week.notes,
    strip,
    session,
    completed: todayDay ? [...(loggedByDate.get(todayKey) ?? [])] : [],
    nextDay: nextDay
      ? { date: nextDay.date, name: nextDay.name, exercises: nextDay.exercises }
      : null,
    fuel,
    snack,
  };
}

export type TodayWorkout = Awaited<ReturnType<typeof getTodayWorkout>>;

async function confirmedKcal(userId: string, date: Date) {
  const agg = await prisma.mealLog.aggregate({
    where: { userId, date, status: "CONFIRMED" },
    _sum: { totalKcal: true },
  });
  return agg._sum.totalKcal ?? 0;
}

/** Pre-workout snack templates built from seeded foods (spec §7: ~20 g protein + 30–40 g carbs). */
const SNACK_TEMPLATES: {
  name: string;
  items: { food: string; quantity: number; unit: string }[];
  diets: string[];
}[] = [
  {
    name: "Curd, banana and 2 boiled eggs",
    items: [
      { food: "curd", quantity: 1, unit: "katori" },
      { food: "banana", quantity: 1, unit: "piece" },
      { food: "boiled egg", quantity: 2, unit: "piece" },
    ],
    diets: ["EGGETARIAN", "NON_VEG"],
  },
  {
    name: "Glass of milk and a banana",
    items: [
      { food: "toned milk", quantity: 1, unit: "glass" },
      { food: "banana", quantity: 1, unit: "piece" },
    ],
    diets: ["VEG", "EGGETARIAN", "NON_VEG"],
  },
  {
    name: "Curd with a banana",
    items: [
      { food: "curd", quantity: 1, unit: "katori" },
      { food: "banana", quantity: 1, unit: "piece" },
    ],
    diets: ["VEG", "EGGETARIAN", "NON_VEG"],
  },
  {
    name: "Milk, banana and 2 boiled eggs",
    items: [
      { food: "toned milk", quantity: 1, unit: "glass" },
      { food: "banana", quantity: 1, unit: "piece" },
      { food: "boiled egg", quantity: 2, unit: "piece" },
    ],
    diets: ["EGGETARIAN", "NON_VEG"],
  },
  {
    name: "Banana and 2 idli",
    items: [
      { food: "banana", quantity: 1, unit: "piece" },
      { food: "idli", quantity: 2, unit: "piece" },
    ],
    diets: ["VEGAN", "VEG", "EGGETARIAN", "NON_VEG"],
  },
];

export type SnackPick = SnackOption & {
  log:
    | { kind: "usual"; mealId: string }
    | { kind: "items"; items: { foodId: string; quantity: number; unit: string; grams: number }[] };
};

async function snackFor(userId: string, diet: string): Promise<SnackPick | null> {
  const names = [...new Set(SNACK_TEMPLATES.flatMap((t) => t.items.map((i) => i.food)))];
  const [foods, usuals] = await Promise.all([
    prisma.food.findMany({ where: { name: { in: names } }, include: { units: true } }),
    getUsuals(userId, 12),
  ]);
  const byName = new Map(foods.map((f) => [f.name, f]));

  const options: SnackPick[] = [];
  for (const u of usuals) {
    options.push({
      id: `usual-${u.mealId}`,
      name: u.names.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(", "),
      kcal: u.kcal,
      proteinG: u.proteinG,
      carbsG: u.carbsG,
      usual: true,
      log: { kind: "usual", mealId: u.mealId },
    });
  }
  for (const t of SNACK_TEMPLATES) {
    if (!t.diets.includes(diet)) continue;
    const items = t.items.map((i) => {
      const food = byName.get(i.food);
      const grams = (food?.units.find((u) => u.unit === i.unit)?.grams ?? 0) * i.quantity;
      return food && grams > 0 ? { food, grams, quantity: i.quantity, unit: i.unit } : null;
    });
    if (items.some((i) => !i)) continue;
    const ok = items as NonNullable<(typeof items)[number]>[];
    const sum = (key: "kcalPer100g" | "proteinPer100g" | "carbsPer100g") =>
      Math.round(ok.reduce((s, i) => s + (i.food[key] * i.grams) / 100, 0));
    options.push({
      id: `template-${t.name}`,
      name: t.name,
      kcal: sum("kcalPer100g"),
      proteinG: sum("proteinPer100g"),
      carbsG: sum("carbsPer100g"),
      log: {
        kind: "items",
        items: ok.map((i) => ({
          foodId: i.food.id,
          quantity: i.quantity,
          unit: i.unit,
          grams: i.grams,
        })),
      },
    });
  }
  return (pickSnack(options) as SnackPick | null) ?? null;
}

/**
 * POST /api/workouts/logs: save one exercise's sets for today and return its next target
 * (spec §6 double progression).
 */
export async function logExercise(
  userId: string,
  input: { planId: string; exerciseSlug: string; sets: SetLog[] },
  today: Date,
) {
  const plan = await prisma.workoutPlan.findFirst({ where: { id: input.planId, userId } });
  if (!plan) throw new HttpError(404, "Plan not found");
  const week = WeekPlanSchema.parse(plan.plan);
  const day: PlanDay | undefined =
    week.days.find(
      (d) => d.date === ymd(today) && d.exercises.some((e) => e.slug === input.exerciseSlug),
    ) ?? week.days.find((d) => d.exercises.some((e) => e.slug === input.exerciseSlug));
  const rx = day?.exercises.find((e) => e.slug === input.exerciseSlug);
  const ex = EXERCISE_BY_SLUG.get(input.exerciseSlug);
  if (!rx || !ex) throw new HttpError(400, "That exercise isn't in this plan");

  const stored: StoredLog = {
    sets: input.sets,
    rx: { sets: rx.sets, repMin: rx.repMin, repMax: rx.repMax, rir: rx.rir, targetKg: rx.targetKg },
  };
  const existing = await prisma.workoutLog.findFirst({
    where: { userId, planId: plan.id, date: today, exerciseSlug: input.exerciseSlug },
    select: { id: true },
  });
  const data = { sets: stored as unknown as Prisma.InputJsonValue, completed: true };
  if (existing) await prisma.workoutLog.update({ where: { id: existing.id }, data });
  else
    await prisma.workoutLog.create({
      data: { userId, planId: plan.id, date: today, exerciseSlug: input.exerciseSlug, ...data },
    });

  const history =
    (await loadHistory(userId, new Date(today.getTime() + DAY)))[input.exerciseSlug] ?? [];
  const next = nextTarget(ex, history, week.phase, rx.targetKg);
  return { exerciseSlug: input.exerciseSlug, next };
}

export type { WeekPlan };
