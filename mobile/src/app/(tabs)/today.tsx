import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Camera, ChevronRight, Dumbbell, Flame, Keyboard, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  CalorieRing,
  InsightCard,
  MacroBar,
  MealRow,
  Screen,
  Skeleton,
  Text,
} from "@/components/ui";
import { QueryError } from "@/components/query-error";
import { useMe } from "@/lib/auth";
import { formatInt, formatTime, MEAL_LABEL, MEAL_TYPES, mealTitle, nextMealType } from "@/lib/format";
import { dayQuery, workoutQuery } from "@/lib/queries";
import { colors, radius } from "@/lib/theme";
import type { Day, TodayWorkout } from "@/lib/types";

function greeting(hour: number) {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Screen 6: intake vs targets for today, meals, and today's workout. */
export default function TodayScreen() {
  const me = useMe();
  const day = useQuery(dayQuery);
  const workout = useQuery(workoutQuery());

  const now = new Date();
  const hour = now.getHours();
  const dateText = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short" }).format(now);
  const firstName = me.name?.split(" ")[0];

  const refresh = () => {
    day.refetch();
    workout.refetch();
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
        {(day.data?.streak ?? 0) > 0 && (
          <View style={styles.streak}>
            <Flame size={16} color={colors.brandGlow} fill={colors.brandGlow} />
            <Text weight={700} size={13} tabular>
              {day.data!.streak}-day streak
            </Text>
          </View>
        )}
      </View>

      {day.isPending ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={228} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      ) : day.isError ? (
        <QueryError error={day.error} onRetry={refresh} />
      ) : (
        <DayContent day={day.data} hour={hour} />
      )}

      <View style={{ gap: 10 }}>
        <Text variant="h2">Workout</Text>
        {workout.isPending ? (
          <Skeleton height={88} />
        ) : workout.data ? (
          <WorkoutCard workout={workout.data} />
        ) : null}
      </View>
    </Screen>
  );
}

function DayContent({ day, hour }: { day: Day; hour: number }) {
  const target = day.target;
  const nextMeal = nextMealType(
    day.meals.map((m) => m.mealType),
    hour,
  );
  const over = target ? day.eaten.kcal - target.kcal : 0;
  const positiveNote =
    target && day.eaten.proteinG >= target.proteinG
      ? `You still hit your protein (${Math.round(day.eaten.proteinG)} g) — that's what matters most. Tomorrow resets.`
      : day.streak > 1
        ? `You've logged ${day.streak} days in a row. One day over doesn't undo that. Tomorrow resets.`
        : "Logging it honestly is the hard part, and you did it. Tomorrow resets.";

  return (
    <>
      {target ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
            <CalorieRing eaten={day.eaten.kcal} target={target.kcal} size={148} />
            <View style={{ flex: 1, gap: 12 }}>
              <MacroBar macro="protein" eaten={day.eaten.proteinG} target={target.proteinG} />
              <MacroBar macro="carbs" eaten={day.eaten.carbsG} target={target.carbsG} />
              <MacroBar macro="fat" eaten={day.eaten.fatG} target={target.fatG} />
            </View>
          </View>
          <View style={styles.divider} />
          <Text size={13} color={colors.ink2} tabular>
            {formatInt(day.eaten.kcal)} eaten of {formatInt(target.kcal)} kcal target
          </Text>
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

        {day.meals.length === 0 ? (
          // Design 6b: nothing logged yet.
          <>
            <Card dark>
              <View style={{ gap: 4 }}>
                <Text variant="h2" size={22} color={colors.white}>
                  Start with {MEAL_LABEL[nextMeal].toLowerCase()}
                </Text>
                <Text size={13} color="rgba(255,255,255,0.75)">
                  Snap your plate and we&apos;ll find the foods, or type it in a line.
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button icon={Camera} onPress={() => router.push({ pathname: "/log", params: { meal: nextMeal } })}>
                    Snap
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    variant="ghostDark"
                    icon={Keyboard}
                    onPress={() => router.push({ pathname: "/log/type", params: { meal: nextMeal } })}
                  >
                    Type
                  </Button>
                </View>
              </View>
            </Card>
            <View style={styles.slots}>
              {MEAL_TYPES.map((t) => (
                <View key={t} style={styles.slot}>
                  <Button
                    variant="dashed"
                    icon={Plus}
                    height={56}
                    onPress={() => router.push({ pathname: "/log", params: { meal: t } })}
                  >
                    {MEAL_LABEL[t]}
                  </Button>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            {day.meals.map((m) => (
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
              onPress={() => router.push({ pathname: "/log", params: { meal: nextMeal } })}
            >
              Add {MEAL_LABEL[nextMeal].toLowerCase()}
            </Button>
          </>
        )}
      </View>
    </>
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
  slots: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slot: { width: "48%", flexGrow: 1 },
  workout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.card,
    backgroundColor: colors.ink,
    padding: 16,
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
