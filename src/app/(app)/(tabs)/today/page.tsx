import { Camera, ChevronRight, Dumbbell, Flame, Keyboard, Plus } from "lucide-react";
import Link from "next/link";
import { Button, CalorieRing, InsightCard, MacroBar, MealRow } from "@/components/ui";
import { localDate } from "@/lib/dates";
import {
  formatInt,
  formatTime,
  MEAL_LABEL,
  MEAL_TYPES,
  mealTitle,
  nextMealType,
} from "@/lib/format";
import { mockWeek } from "@/lib/mock/workout";
import { getDay, loggingStreak } from "@/lib/services/dashboard";
import { presignRead } from "@/lib/storage/s3";
import { requireOnboardedViewer } from "@/lib/viewer";

export const metadata = { title: "Today — FitLens" };

function greeting(hour: number) {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Screen 6: intake vs targets for today, meals, and today's workout. Same data as GET /api/dashboard. */
export default async function TodayPage() {
  const { userId, name, profile, timezone } = await requireOnboardedViewer();
  const today = localDate(timezone);
  const [day, streak] = await Promise.all([getDay(userId, today), loggingStreak(userId, today)]);

  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(now),
  );
  const dateText = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(now);
  const firstName = name?.split(" ")[0];

  const meals = await Promise.all(
    day.meals.map(async (m) => ({
      ...m,
      photoUrl: m.photoKey ? await presignRead(m.photoKey, 3600).catch(() => null) : null,
    })),
  );
  const nextMeal = nextMealType(
    meals.map((m) => m.mealType),
    hour,
  );

  const target = day.target;
  const over = target ? day.eaten.kcal - target.kcal : 0;
  const positiveNote =
    target && day.eaten.proteinG >= target.proteinG
      ? `You still hit your protein (${Math.round(day.eaten.proteinG)} g) — that's what matters most. Tomorrow resets.`
      : streak > 1
        ? `You've logged ${streak} days in a row. One day over doesn't undo that. Tomorrow resets.`
        : "Logging it honestly is the hard part, and you did it. Tomorrow resets.";
  const workout = mockWeek({
    today,
    equipment: profile.equipment,
    daysPerWeek: profile.trainingDaysPerWeek,
    sessionMinutes: profile.sessionMinutes,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-ink-3">{dateText}</p>
          <h1 className="display text-[28px] leading-tight">
            {greeting(hour)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        {streak > 0 && (
          <p className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-[13px] font-bold tabular-nums">
            <Flame className="size-4 fill-brand-glow text-brand-glow" aria-hidden />
            {streak}-day streak
          </p>
        )}
      </header>

      {target ? (
        <section
          className="flex flex-col gap-4 rounded-card bg-surface p-4"
          aria-label="Today's intake"
        >
          <div className="flex items-center gap-5">
            <CalorieRing eaten={day.eaten.kcal} target={target.kcal} size={148} />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <MacroBar macro="protein" eaten={day.eaten.proteinG} target={target.proteinG} />
              <MacroBar macro="carbs" eaten={day.eaten.carbsG} target={target.carbsG} />
              <MacroBar macro="fat" eaten={day.eaten.fatG} target={target.fatG} />
            </div>
          </div>
          <p className="border-t border-line pt-3 text-[13px] text-ink-2 tabular-nums">
            {formatInt(day.eaten.kcal)} eaten of {formatInt(target.kcal)} kcal target
          </p>
        </section>
      ) : (
        <section className="rounded-card bg-surface p-4 text-ink-2">
          No targets yet.{" "}
          <Link href="/onboarding" className="font-semibold text-brand underline">
            Finish your plan
          </Link>
        </section>
      )}

      {target && over > 0 && (
        // Design 6c: neutral, never shaming.
        <InsightCard headline="A little over. No stress." reason={positiveNote} />
      )}

      <section className="flex flex-col gap-2.5" aria-labelledby="meals-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="meals-heading" className="display text-[19px]">
            Meals
          </h2>
          <Link
            href="/history"
            className="-mr-2 flex min-h-11 items-center px-2 text-[13px] font-semibold text-brand"
          >
            History
          </Link>
        </div>
        {meals.length === 0 ? (
          // Design 6b: nothing logged yet.
          <>
            <div className="flex flex-col gap-3 rounded-card bg-ink p-5 text-white">
              <div>
                <p className="display text-[22px] leading-tight">
                  Start with {MEAL_LABEL[nextMeal].toLowerCase()}
                </p>
                <p className="mt-1 text-[13px] text-white/75">
                  Snap your plate and we&apos;ll find the foods, or type it in a line.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild>
                  <Link href={`/log?meal=${nextMeal}`}>
                    <Camera className="size-5" aria-hidden />
                    Snap
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/15"
                >
                  <Link href={`/log/type?meal=${nextMeal}`}>
                    <Keyboard className="size-5" aria-hidden />
                    Type
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {MEAL_TYPES.map((t) => (
                <Button key={t} asChild variant="dashed" className="h-14">
                  <Link href={`/log?meal=${t}`}>
                    <Plus className="size-5" aria-hidden />
                    {MEAL_LABEL[t]}
                  </Link>
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            {meals.map((m) => (
              <MealRow
                key={m.id}
                href={`/log/${m.id}`}
                photoUrl={m.photoUrl}
                meta={`${MEAL_LABEL[m.mealType]} · ${formatTime(m.createdAt, timezone)}`}
                title={mealTitle(
                  m.items.map((i) => i.name),
                  m.source === "TEXT" ? (m.inputText ?? "Typed meal") : "Photo",
                )}
                kcal={m.totalKcal}
                status={m.status}
              />
            ))}
            <Button asChild variant="dashed">
              <Link href={`/log?meal=${nextMeal}`}>
                <Plus className="size-5" aria-hidden />
                Add {MEAL_LABEL[nextMeal].toLowerCase()}
              </Link>
            </Button>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2.5" aria-labelledby="workout-heading">
        <h2 id="workout-heading" className="display text-[19px]">
          Workout
        </h2>
        <Link
          href="/workout"
          className="flex items-center gap-3 rounded-card bg-ink p-4 text-white"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/10">
            <Dumbbell className="size-6" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            {workout.isTrainingDay ? (
              <>
                <span className="text-[12px] font-semibold text-white/70">Today</span>
                <span className="font-semibold">{workout.session.name}</span>
                <span className="text-[13px] text-white/70">
                  {workout.session.exercises.length} exercises · {workout.session.minutes} min
                </span>
              </>
            ) : (
              <>
                <span className="text-[12px] font-semibold text-white/70">Rest day</span>
                <span className="font-semibold">Recover — a walk counts</span>
                {workout.nextDay && (
                  <span className="text-[13px] text-white/70">
                    Next session{" "}
                    {new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(
                      new Date(workout.nextDay.date),
                    )}
                  </span>
                )}
              </>
            )}
          </span>
          <ChevronRight className="size-5 shrink-0 text-white/70" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
