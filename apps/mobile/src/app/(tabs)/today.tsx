import { useQuery } from "@tanstack/react-query";
import { TodaySkeleton, WorkoutCardSkeleton } from "@/components/skeletons";
import { router } from "expo-router";
import { Camera, ChevronLeft, ChevronRight, Dumbbell, Flame, Keyboard, MessageCircle, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Card, CalorieRing, InsightCard, MacroBar, MealRow, Screen, Text } from "@/components/ui";
import { QueryError } from "@/components/query-error";
import { useWater, WaterBar, WaterQuickAdd } from "@/components/water-card";
import { queryClient } from "@/lib/query";
import { useMe } from "@/lib/auth";
import { formatInt, formatTime, MEAL_LABEL, MEAL_TYPES, mealTitle } from "@/lib/format";
import { dayFromParam, dayLabel, recentDays } from "@/lib/meal-param";
import { api } from "@/lib/api";
import { dayQuery, workoutQuery } from "@/lib/queries";
import { showDay, useViewDay } from "@/lib/view-day";
import { colors, radius } from "@/lib/theme";
import type { Day, TodayWorkout } from "@/lib/types";

function greeting(hour: number) {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Screen 6: intake vs targets for today (or a recent day, to fill in a forgotten meal), meals, and today's workout. */
export default function TodayScreen() {
  const me = useMe();
  // null = today. A day that has slid out of the window (app left open for days) falls back to today.
  const viewDay = dayFromParam(useViewDay() ?? undefined);
  const day = useQuery(
    viewDay ? { queryKey: ["day", viewDay], queryFn: () => api<Day>(`/api/dashboard?date=${viewDay}`) } : dayQuery,
  );
  const workout = useQuery(workoutQuery());

  const now = new Date();
  const hour = now.getHours();
  const dateText = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short" }).format(now);
  const firstName = me.name?.split(" ")[0];

  const refresh = () => {
    day.refetch();
    workout.refetch();
    queryClient.invalidateQueries({ queryKey: ["water"] });
  };

  return (
    <Screen tabBar refreshing={day.isRefetching} onRefresh={refresh}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="meta">{dateText}</Text>
          <Text variant="h1">
            {greeting(hour)}
            {firstName ? `, ${firstName}` : ""}
          </Text>
        </View>
        {!viewDay && (day.data?.streak ?? 0) > 0 && (
          <View style={styles.streak}>
            <Flame size={16} color={colors.brandGlow} fill={colors.brandGlow} />
            <Text weight={700} size={13} tabular>
              {day.data!.streak}-day streak
            </Text>
          </View>
        )}
      </View>

      <DaySwitcher viewDay={viewDay} />

      {day.isPending ? (
        <TodaySkeleton />
      ) : day.isError ? (
        <QueryError error={day.error} onRetry={refresh} />
      ) : (
        <DayContent day={day.data} pastDay={viewDay} />
      )}

      {!viewDay && (
        <>
          <View style={{ gap: 10 }}>
            <Text variant="h2">Workout</Text>
            {workout.isPending ? <WorkoutCardSkeleton /> : workout.data ? <WorkoutCard workout={workout.data} /> : null}
          </View>

          <CoachRow />
        </>
      )}
    </Screen>
  );
}

function DayContent({ day, pastDay }: { day: Day; pastDay: string | null }) {
  const target = day.target;
  const water = useWater();
  const over = target ? day.eaten.kcal - target.kcal : 0;
  const positiveNote =
    target && day.eaten.proteinG >= target.proteinG
      ? `You still hit your protein (${Math.round(day.eaten.proteinG)} g) — that's what matters most. Tomorrow resets.`
      : day.streak > 1
        ? `You've logged ${day.streak} days in a row. One day over doesn't undo that. Tomorrow resets.`
        : "Logging it honestly is the hard part, and you did it. Tomorrow resets.";
  // Every "add" names its meal (the user picks it) and, for a past day, carries the date.
  const logParams = (meal?: string) => ({ ...(meal ? { meal } : {}), ...(pastDay ? { date: pastDay } : {}) });
  const dayName = pastDay ? dayLabel(pastDay).toLowerCase() : "today";

  return (
    <>
      {target ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
            <CalorieRing eaten={day.eaten.kcal} target={target.kcal} size={148} />
            <View style={{ flex: 1, gap: 10 }}>
              <MacroBar macro="protein" eaten={day.eaten.proteinG} target={target.proteinG} />
              <MacroBar macro="carbs" eaten={day.eaten.carbsG} target={target.carbsG} />
              <MacroBar macro="fat" eaten={day.eaten.fatG} target={target.fatG} />
              {!pastDay && <WaterBar day={water.water.data} />}
            </View>
          </View>
          <View style={styles.divider} />
          <Text size={13} color={colors.ink2} tabular>
            {formatInt(day.eaten.kcal)} eaten of {formatInt(target.kcal)} kcal target
          </Text>
          {!pastDay && <WaterQuickAdd water={water} />}
        </Card>
      ) : (
        <Card>
          <Text color={colors.ink2}>No targets yet. Finish your plan on the Profile tab.</Text>
        </Card>
      )}

      {target && over > 0 && <InsightCard headline="A little over. No stress." reason={positiveNote} />}

      <View style={{ gap: 10 }}>
        <View style={styles.sectionHead}>
          <Text variant="h2">Meals</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push("/history")} hitSlop={12}>
            <Text weight={600} size={13} color={colors.brand}>
              History
            </Text>
          </Pressable>
        </View>

        {day.meals.length === 0 && (
          // Design 6b: nothing logged yet. Snap / Type ask which meal on the next screen.
          <Card dark>
            <View style={{ gap: 4 }}>
              <Text variant="h2" size={22} color={colors.white}>
                {pastDay ? `Nothing logged for ${dayName}` : "Log your first meal"}
              </Text>
              <Text size={13} color="rgba(255,255,255,0.75)">
                {pastDay
                  ? "Forgot to log? Add what you ate below and it counts for that day."
                  : "Snap your plate and we'll find the foods, or type it in a line."}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button icon={Camera} onPress={() => router.push({ pathname: "/log", params: logParams() })}>
                  Snap
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant="ghostDark"
                  icon={Keyboard}
                  onPress={() => router.push({ pathname: "/log/type", params: logParams() })}
                >
                  Type
                </Button>
              </View>
            </View>
          </Card>
        )}

        {/* One section per meal, in day order, each with its own add button. */}
        {MEAL_TYPES.map((t) => {
          const meals = day.meals.filter((m) => m.mealType === t);
          const kcal = meals.reduce((sum, m) => sum + (m.status === "CONFIRMED" ? m.totalKcal : 0), 0);
          return (
            <View key={t} style={{ gap: 8 }}>
              {meals.length > 0 && (
                <View style={styles.sectionHead}>
                  <Text weight={600}>{MEAL_LABEL[t]}</Text>
                  <Text weight={600} size={13} color={colors.ink3} tabular>
                    {formatInt(kcal)} kcal
                  </Text>
                </View>
              )}
              {meals.map((m) => (
                <MealRow
                  key={m.id}
                  onPress={() => router.push(`/log/${m.id}`)}
                  photoUrl={m.photoUrl}
                  meta={`${MEAL_LABEL[m.mealType]} · ${formatTime(m.createdAt, day.timezone)}`}
                  title={mealTitle(
                    m.items.map((i) => i.name),
                    m.source === "TEXT" ? (m.inputText ?? "Typed meal") : "Photo",
                  )}
                  kcal={m.totalKcal}
                  status={m.status}
                />
              ))}
              <Button
                variant="dashed"
                icon={Plus}
                height={meals.length ? undefined : 52}
                onPress={() => router.push({ pathname: "/log", params: logParams(t) })}
              >
                {meals.length ? `Add more to ${MEAL_LABEL[t].toLowerCase()}` : `Add ${MEAL_LABEL[t].toLowerCase()}`}
              </Button>
            </View>
          );
        })}
      </View>
    </>
  );
}

/**
 * ‹ Today › — step back up to a week to see a day and add a meal you forgot to log. Older days are
 * in History; the API won't take meals further back.
 */
function DaySwitcher({ viewDay }: { viewDay: string | null }) {
  const days = recentDays(); // today first
  const index = viewDay ? Math.max(0, days.indexOf(viewDay)) : 0;
  const go = (i: number) => showDay(i === 0 ? null : days[i]);
  const older = index < days.length - 1;
  const newer = index > 0;
  return (
    <View style={styles.switcher} accessibilityLabel="Choose a day">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous day"
        accessibilityState={{ disabled: !older }}
        disabled={!older}
        onPress={() => go(index + 1)}
        hitSlop={8}
        style={[styles.switchBtn, !older && { opacity: 0.3 }]}
      >
        <ChevronLeft size={20} color={colors.ink} />
      </Pressable>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text weight={600} accessibilityLiveRegion="polite">
          {dayLabel(days[index])}
        </Text>
        {newer && (
          <Pressable accessibilityRole="button" onPress={() => go(0)} hitSlop={8}>
            <Text weight={600} size={12} color={colors.brand}>
              Back to today
            </Text>
          </Pressable>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next day"
        accessibilityState={{ disabled: !newer }}
        disabled={!newer}
        onPress={() => go(index - 1)}
        hitSlop={8}
        style={[styles.switchBtn, !newer && { opacity: 0.3 }]}
      >
        <ChevronRight size={20} color={colors.ink} />
      </Pressable>
    </View>
  );
}

/** One row into the coach chat; the chat itself lives on its own screen. */
function CoachRow() {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/coach")}
      style={({ pressed }) => [styles.coach, pressed && { backgroundColor: colors.sunken }]}
    >
      <View style={styles.coachIcon}>
        <MessageCircle size={22} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight={600}>Ask your coach</Text>
        <Text size={13} color={colors.ink2}>
          Food, training or today&apos;s numbers
        </Text>
      </View>
      <ChevronRight size={20} color={colors.ink3} />
    </Pressable>
  );
}

function WorkoutCard({ workout }: { workout: TodayWorkout }) {
  const s = workout.session;
  const white70 = "rgba(255,255,255,0.7)";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/briefing")}
      style={({ pressed }) => [styles.workout, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.workoutIcon}>
        <Dumbbell size={24} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        {s ? (
          <>
            <Text weight={600} size={12} color={white70}>
              {workout.completed.length >= s.exercises.length ? "Done today" : "Today"}
            </Text>
            <Text weight={600} color={colors.white}>
              {s.name}
            </Text>
            <Text size={13} color={white70}>
              {s.exercises.length} exercises · ~{s.estimatedMinutes} min · see your coach&apos;s plan
            </Text>
          </>
        ) : (
          <>
            <Text weight={600} size={12} color={white70}>
              Rest day
            </Text>
            <Text weight={600} color={colors.white}>
              Recover — a walk counts
            </Text>
            {workout.nextDay && (
              <Text size={13} color={white70}>
                Next session{" "}
                {new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(
                  new Date(workout.nextDay.date),
                )}
              </Text>
            )}
          </>
        )}
      </View>
      <ChevronRight size={20} color={white70} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  switcher: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 52,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
  },
  switchBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  streak: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  divider: { height: 1, backgroundColor: colors.line },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  workout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.card,
    backgroundColor: colors.ink,
    padding: 16,
  },
  coach: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 72,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    padding: 16,
  },
  coachIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    alignItems: "center",
    justifyContent: "center",
  },
  workoutIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
});
