import {
  Camera,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  Keyboard,
  MessageCircle,
  PartyPopper,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { Button, InsightCard, MealRow } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  formatInt,
  formatTime,
  MEAL_LABEL,
  MEAL_TYPES,
  mealTitle,
  nextMealType,
} from "@fitr8/domain/format";
import { requireOnboardedViewer, serverApi, serverApiOrNull } from "@/lib/server/api";
import type { DashboardDto, TodayWorkoutDto, WaterDayDto } from "@fitr8/contracts";
import { IntakeCard } from "./intake-card";

export const metadata = { title: "Today — FITR8" };

function greeting(hour: number) {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Screen 6: intake vs targets for today (with water), meals, and today's workout. One column on
 * phones; on desktop, intake + meals on the left and workout + coach on the right.
 */
export default async function TodayPage() {
  const { name, timezone, profile } = await requireOnboardedViewer();
  const [day, workout, water] = await Promise.all([
    serverApi<DashboardDto>("/dashboard"),
    serverApi<TodayWorkoutDto>("/workouts/today"),
    // Water is a bonus on this screen: if it fails, the card just leaves it out.
    serverApiOrNull<WaterDayDto>("/water"),
  ]);
  const { streak, meals } = day;

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
  // First two days with nothing logged: point new users at the app and their first meal.
  const isNew =
    meals.length === 0 &&
    now.getTime() - new Date(profile.onboardedAt ?? 0).getTime() < 2 * 86_400_000;

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

      {isNew && day.target && (
        <section className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-card bg-fitr8-lilac-soft p-4">
          <span className="grid size-[42px] shrink-0 place-items-center rounded-xl bg-brand text-white">
            <PartyPopper className="size-5" aria-hidden />
          </span>
          <p className="min-w-[200px] flex-1">
            <span className="block font-semibold">Your plan is live</span>
            <span className="text-sm text-ink-2 tabular-nums">
              {formatInt(day.target.kcal)} kcal a day. Log your first meal and FITR8 starts learning
              your week.
            </span>
          </p>
          <Link
            href="/onboarding/app"
            className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-white/70"
          >
            Get the app
          </Link>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6">
          {target ? (
            <IntakeCard eaten={day.eaten} target={target} initialWater={water} />
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
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
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
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-10">
          <section className="flex flex-col gap-2.5" aria-labelledby="workout-heading">
            <h2 id="workout-heading" className="display text-[19px]">
              Workout
            </h2>
            <Link
              href="/workout/brief"
              className="flex lift flex-col gap-4 rounded-card bg-ink p-4 text-white"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/10">
                  <Dumbbell className="size-6" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  {workout.session ? (
                    <>
                      <span className="text-[12px] font-semibold text-white/70">
                        {workout.completed.length >= workout.session.exercises.length
                          ? "Done today"
                          : "Today"}
                      </span>
                      <span className="font-semibold">{workout.session.name}</span>
                      <span className="text-[13px] text-white/70">
                        {workout.session.exercises.length} exercises · ~
                        {workout.session.estimatedMinutes} min · see your coach&apos;s plan
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[12px] font-semibold text-white/70">Rest day</span>
                      <span className="font-semibold">Recover — a walk counts</span>
                      {workout.nextDay && (
                        <span className="text-[13px] text-white/70">
                          Next session{" "}
                          {new Intl.DateTimeFormat("en-IN", {
                            weekday: "long",
                            timeZone: "UTC",
                          }).format(new Date(workout.nextDay.date))}
                        </span>
                      )}
                    </>
                  )}
                </span>
                <ChevronRight className="size-5 shrink-0 text-white/70" aria-hidden />
              </span>
              {/* Desktop has room for the week at a glance. */}
              <span className="hidden grid-cols-7 gap-1 lg:grid" aria-hidden>
                {workout.strip.map((d) => (
                  <span
                    key={d.date}
                    className={cn(
                      "flex h-11 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-bold",
                      d.state === "today" && "bg-brand text-white",
                      d.state === "done" && "bg-white/15 text-white",
                      d.state === "planned" && "bg-white/8 text-white/80",
                      d.state === "missed" && "border border-dashed border-white/25 text-white/50",
                      (d.state === "rest" || d.state === "before") && "text-white/40",
                    )}
                  >
                    {new Intl.DateTimeFormat("en-IN", {
                      weekday: "narrow",
                      timeZone: "UTC",
                    }).format(new Date(d.date))}
                    {d.state === "done" ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : (
                      <span
                        className={cn(
                          "size-1 rounded-full",
                          d.state === "rest" || d.state === "before"
                            ? "bg-transparent"
                            : "bg-current",
                        )}
                      />
                    )}
                  </span>
                ))}
              </span>
            </Link>
          </section>

          <Link href="/coach" className="flex lift items-center gap-3 rounded-card bg-surface p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-protein-soft text-protein">
              <MessageCircle className="size-6" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">Ask your coach</span>
              <span className="text-[13px] text-ink-3">Meals, training or your plan</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}
