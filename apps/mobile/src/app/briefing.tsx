import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BriefingSkeleton } from "@/components/skeletons";
import { router } from "expo-router";
import { BatteryLow, CircleCheck, Coffee, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { BackHeader } from "@/components/back-header";
import { QueryError } from "@/components/query-error";
import { Button, Card, FieldError, Screen, Segmented, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { setEnergy, useEnergy } from "@/lib/energy";
import { formatInt } from "@/lib/format";
import { workoutQuery } from "@/lib/queries";
import { refreshDay } from "@/lib/query";
import { colors, radius } from "@/lib/theme";
import type { Energy, TodayWorkout } from "@/lib/types";

const weekday = (ymd: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(new Date(ymd));

/** Screen 10a: fuel, pre-workout snack, energy check, the coach's rules and today's prescriptions. */
export default function BriefingScreen() {
  const energy = useEnergy();
  const workout = useQuery({ ...workoutQuery(energy), placeholderData: keepPreviousData });

  if (workout.isPending) {
    return (
      <Screen>
        <BackHeader />
        <BriefingSkeleton />
      </Screen>
    );
  }
  if (workout.isError) {
    return (
      <Screen>
        <BackHeader />
        <QueryError error={workout.error} onRetry={() => workout.refetch()} />
      </Screen>
    );
  }
  return <Briefing data={workout.data} energy={energy} switching={workout.isPlaceholderData} />;
}

function Briefing({ data, energy, switching }: { data: TodayWorkout; energy: Energy; switching: boolean }) {
  const [snackState, setSnackState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const session = data.session;

  async function logSnack() {
    if (!data.snack) return;
    setSnackState("saving");
    setError(null);
    try {
      if (data.snack.log.kind === "usual") {
        await api("/api/meals/relog", { json: { mealId: data.snack.log.mealId, mealType: "SNACK" } });
      } else {
        await api("/api/meals/log-items", { json: { mealType: "SNACK", items: data.snack.log.items } });
      }
      setSnackState("done");
      refreshDay();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't log it. Try again.");
      setSnackState("idle");
    }
  }

  if (!session) {
    return (
      <Screen>
        <BackHeader />
        <View>
          <Text variant="meta">Coach briefing</Text>
          <Text variant="h1">Rest day</Text>
        </View>
        <Card>
          <Text color={colors.ink2}>{data.cardio}</Text>
        </Card>
        {data.nextDay && (
          <Text color={colors.ink2}>
            Next: <Text weight={600}>{data.nextDay.name}</Text> on {weekday(data.nextDay.date)}.
          </Text>
        )}
        <Button variant="secondary" onPress={() => router.navigate("/workout")}>
          See this week
        </Button>
      </Screen>
    );
  }

  const low = data.fuel.low;
  return (
    <Screen footer={<Button onPress={() => router.navigate("/workout")}>Start workout</Button>}>
      <BackHeader />
      <View style={{ gap: 16, opacity: switching ? 0.6 : 1 }}>
        <View>
          <Text variant="meta">Coach briefing{data.deload ? " · deload week" : ""}</Text>
          <Text variant="h1">
            {session.name} · {data.sessionMinutes} min
          </Text>
        </View>

        <View
          accessibilityLabel="Fuel"
          style={[styles.fuel, { backgroundColor: low ? colors.cautionSoft : colors.proteinSoft }]}
        >
          {low ? <BatteryLow size={24} color={colors.cautionText} /> : <CircleCheck size={24} color={colors.protein} />}
          <View style={{ flex: 1 }}>
            <Text weight={700} color={low ? colors.cautionText : colors.protein}>
              {low ? "Running low" : "Fuelled"}
            </Text>
            <Text size={13} color={colors.ink2} tabular>
              {formatInt(data.fuel.eatenKcal)} of {formatInt(data.fuel.targetKcal)} kcal so far today
            </Text>
          </View>
        </View>

        {low && data.snack && (
          <Card accessibilityLabel="Pre-workout snack">
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <View style={styles.snackIcon}>
                <Coffee size={20} color={colors.ink2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text weight={600} size={12} color={colors.ink3}>
                  Before you train{data.snack.usual ? " · one of your usuals" : ""}
                </Text>
                <Text weight={600}>{data.snack.name}</Text>
                <Text size={13} color={colors.ink3} tabular>
                  P {data.snack.proteinG} g · C {data.snack.carbsG} g · {formatInt(data.snack.kcal)} kcal
                </Text>
              </View>
            </View>
            <Button
              variant="secondary"
              onPress={logSnack}
              loading={snackState === "saving"}
              disabled={snackState === "done"}
            >
              {snackState === "done" ? "Logged as a snack" : "Log it"}
            </Button>
            {error && <FieldError>{error}</FieldError>}
          </Card>
        )}

        <View style={{ gap: 8 }}>
          <Text variant="label">How&apos;s your energy?</Text>
          <Segmented
            label="Energy"
            value={energy}
            onChange={setEnergy}
            options={[
              { value: "great", label: "Great" },
              { value: "ok", label: "OK" },
              { value: "tired", label: "Tired" },
            ]}
          />
        </View>

        <Card dark style={{ padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color={colors.brandGlow} />
            <Text weight={600} size={13} color="rgba(255,255,255,0.7)">
              What your coach set today
            </Text>
          </View>
          {session.rules.map((r) => (
            <View key={r.title}>
              <Text weight={600} color={colors.white}>
                {r.title}
              </Text>
              <Text size={13} color="rgba(255,255,255,0.75)">
                {r.reason}
              </Text>
            </View>
          ))}
        </Card>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text variant="h2">Today</Text>
            <Text variant="meta" tabular>
              ~{session.estimatedMinutes} min
            </Text>
          </View>
          <View style={styles.list}>
            {session.exercises.map((e, i) => {
              const trimmed = e.sets < e.plannedSets;
              return (
                <View key={e.slug} style={[styles.item, i > 0 && styles.divider]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight={600}>{e.name}</Text>
                    <Text weight={600} size={12} color={colors.ink3}>
                      {e.role === "main" ? "Main lift" : e.role === "secondary" ? "Second lift" : "Accessory"} · {e.rir}{" "}
                      in reserve{e.bonusRep ? " · +1 rep on last set" : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text weight={600} tabular color={trimmed ? colors.protein : colors.ink}>
                      {e.sets} × {e.repMin}–{e.repMax}
                      {e.timed ? " s" : ""}
                    </Text>
                    {trimmed && (
                      <Text weight={600} size={12} color={colors.protein}>
                        was {e.plannedSets} sets
                      </Text>
                    )}
                    {e.targetKg != null && (
                      <Text weight={500} size={13} color={colors.ink3} tabular>
                        {e.targetKg} kg
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fuel: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.card, padding: 16 },
  snackIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { borderRadius: radius.card, backgroundColor: colors.surface },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
