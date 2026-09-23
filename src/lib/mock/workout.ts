/**
 * Placeholder workout data for the Workout screen and the Today card until
 * POST /api/workouts/generate lands (roadmap week 4). Deterministic from the profile.
 */
export type Equipment = "FULL_GYM" | "DUMBBELLS" | "BODYWEIGHT";

export interface MockSet {
  kg: number | null; // null = bodyweight
  reps: number;
}

export interface MockExercise {
  slug: string;
  name: string;
  muscleGroup: string;
  sets: MockSet[];
  /** Why the numbers are what they are (progression rule). */
  hint: string;
}

export interface MockSession {
  name: string;
  minutes: number;
  exercises: MockExercise[];
}

export type DayState = "done" | "today" | "planned" | "rest";

export interface WeekDay {
  date: string; // YYYY-MM-DD
  letter: string;
  state: DayState;
  training: boolean;
  isToday: boolean;
}

const sets = (n: number, reps: number, kg: number | null): MockSet[] =>
  Array.from({ length: n }, () => ({ kg, reps }));

const LIBRARY: Record<Equipment, MockExercise[]> = {
  FULL_GYM: [
    {
      slug: "barbell-back-squat",
      name: "Barbell back squat",
      muscleGroup: "Legs",
      sets: sets(3, 8, 60),
      hint: "Hit 8 reps on all sets last time — up 2.5 kg.",
    },
    {
      slug: "barbell-bench-press",
      name: "Barbell bench press",
      muscleGroup: "Chest",
      sets: sets(3, 8, 45),
      hint: "Same weight as last week; aim for one more rep per set.",
    },
    {
      slug: "lat-pulldown",
      name: "Lat pulldown",
      muscleGroup: "Back",
      sets: sets(3, 10, 40),
      hint: "Pause 1 s at the bottom of each rep.",
    },
    {
      slug: "romanian-deadlift",
      name: "Romanian deadlift",
      muscleGroup: "Hamstrings",
      sets: sets(3, 10, 50),
      hint: "Stop when your back starts to round.",
    },
    {
      slug: "plank",
      name: "Plank",
      muscleGroup: "Core",
      sets: sets(3, 40, null),
      hint: "Reps are seconds. Add 5 s when all sets feel easy.",
    },
  ],
  DUMBBELLS: [
    {
      slug: "dumbbell-goblet-squat",
      name: "Dumbbell goblet squat",
      muscleGroup: "Legs",
      sets: sets(3, 10, 16),
      hint: "Hit 10 reps on all sets last time — up to 18 kg next.",
    },
    {
      slug: "dumbbell-row",
      name: "One-arm dumbbell row",
      muscleGroup: "Back",
      sets: sets(3, 10, 14),
      hint: "Each side. Keep your hips square.",
    },
    {
      slug: "dumbbell-shoulder-press",
      name: "Dumbbell shoulder press",
      muscleGroup: "Shoulders",
      sets: sets(3, 8, 10),
      hint: "Same weight as last week; add a rep where you can.",
    },
    {
      slug: "push-up",
      name: "Push-up",
      muscleGroup: "Chest",
      sets: sets(3, 12, null),
      hint: "Stop 2 reps before failure.",
    },
    {
      slug: "plank",
      name: "Plank",
      muscleGroup: "Core",
      sets: sets(3, 40, null),
      hint: "Reps are seconds. Add 5 s when all sets feel easy.",
    },
  ],
  BODYWEIGHT: [
    {
      slug: "bodyweight-squat",
      name: "Bodyweight squat",
      muscleGroup: "Legs",
      sets: sets(3, 15, null),
      hint: "Slow 3 s down. Add reps before adding speed.",
    },
    {
      slug: "push-up",
      name: "Push-up",
      muscleGroup: "Chest",
      sets: sets(3, 10, null),
      hint: "Hit 10 on every set? Try feet-elevated next week.",
    },
    {
      slug: "glute-bridge",
      name: "Glute bridge",
      muscleGroup: "Glutes",
      sets: sets(3, 15, null),
      hint: "Squeeze for 1 s at the top.",
    },
    {
      slug: "plank",
      name: "Plank",
      muscleGroup: "Core",
      sets: sets(3, 40, null),
      hint: "Reps are seconds. Add 5 s when all sets feel easy.",
    },
  ],
};

/** Training weekdays (0 = Monday) for 2–6 sessions a week. */
const PATTERN: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** `today` is a UTC-midnight date for the user's local day (see lib/dates.localDate). */
export function mockWeek(opts: {
  today: Date;
  equipment: Equipment;
  daysPerWeek: number;
  sessionMinutes: number;
}) {
  const days = PATTERN[Math.min(6, Math.max(2, opts.daysPerWeek))];
  const todayIdx = (opts.today.getUTCDay() + 6) % 7;
  const monday = new Date(opts.today.getTime() - todayIdx * 86_400_000);

  const week: WeekDay[] = LETTERS.map((letter, i) => {
    const training = days.includes(i);
    const date = new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const state: DayState =
      i === todayIdx && training ? "today" : !training ? "rest" : i < todayIdx ? "done" : "planned";
    return { date, letter, state, training, isToday: i === todayIdx };
  });

  const exercises = LIBRARY[opts.equipment];
  const count = opts.sessionMinutes <= 30 ? Math.min(3, exercises.length) : exercises.length;
  const session: MockSession = {
    name: opts.equipment === "BODYWEIGHT" ? "Full body · home" : "Full body A",
    minutes: opts.sessionMinutes,
    exercises: exercises.slice(0, count),
  };

  const isTrainingDay = days.includes(todayIdx);
  const nextIdx = days.find((d) => d > todayIdx);
  return { week, session, isTrainingDay, nextDay: nextIdx != null ? week[nextIdx] : null };
}
