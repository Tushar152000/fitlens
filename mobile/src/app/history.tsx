import { useQuery } from "@tanstack/react-query";
import { HistorySkeleton } from "@/components/skeletons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BackHeader } from "@/components/back-header";
import { QueryError } from "@/components/query-error";
import { Card, MealRow, Screen, Segmented, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { formatInt, formatTime, MEAL_LABEL, type MealType } from "@/lib/format";
import { colors, radius } from "@/lib/theme";

interface HistoryDay {
  date: string;
  kcal: number;
  proteinG: number;
  target: number | null;
  logged: boolean;
  isToday: boolean;
  meals: { id: string; mealType: string; title: string; kcal: number; createdAt: string }[];
}

interface History {
  days: HistoryDay[];
  daysLogged: number;
  avgKcalFullDays: number | null;
}

const dayLabel = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(new Date(ymd));

/** Screen 12: 7/30-day intake history with a tappable day list. */
export default function HistoryScreen() {
  const [range, setRange] = useState<7 | 30>(7);
  const [picked, setPicked] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ["history", range],
    queryFn: () => api<History>(`/api/history?days=${range}`),
  });
  const h = history.data;
  const selected = h ? (h.days.find((d) => d.date === picked) ?? h.days[h.days.length - 1]) : null;

  return (
    <Screen refreshing={history.isRefetching} onRefresh={() => history.refetch()}>
      <BackHeader />
      <View>
        <Text variant="meta">Meal history</Text>
        <Text variant="h1">History</Text>
      </View>
      <Segmented
        label="Range"
        value={range}
        onChange={(v) => {
          setRange(v);
          setPicked(null);
        }}
        options={[
          { value: 7, label: "7 days" },
          { value: 30, label: "30 days" },
        ]}
      />
      {history.isPending ? (
        <HistorySkeleton />
      ) : history.isError ? (
        <QueryError error={history.error} onRetry={() => history.refetch()} />
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={styles.tile}>
              <Text weight={600} size={12} color={colors.ink3}>
                Average on full days
              </Text>
              <Text variant="h2" size={22} tabular>
                {h!.avgKcalFullDays == null ? "—" : formatInt(h!.avgKcalFullDays)}
                {h!.avgKcalFullDays != null && (
                  <Text weight={600} size={13} color={colors.ink3}>
                    {" "}
                    kcal
                  </Text>
                )}
              </Text>
            </View>
            <View style={styles.tile}>
              <Text weight={600} size={12} color={colors.ink3}>
                Days logged
              </Text>
              <Text variant="h2" size={22} tabular>
                {h!.daysLogged}
                <Text weight={600} size={13} color={colors.ink3}>
                  {" "}
                  of {range}
                </Text>
              </Text>
            </View>
          </View>

          <DailyBars days={h!.days} range={range} selected={selected!.date} onSelect={setPicked} />

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text variant="h2">
                {selected!.isToday ? "Today" : dayLabel(selected!.date, { weekday: "long", day: "numeric", month: "short" })}
              </Text>
              <Text variant="meta" tabular>
                {formatInt(selected!.kcal)}
                {selected!.target ? ` / ${formatInt(selected!.target)}` : ""} kcal
              </Text>
            </View>
            {selected!.meals.length ? (
              selected!.meals.map((m) => (
                <MealRow
                  key={m.id}
                  onPress={() => router.push(`/log/${m.id}`)}
                  meta={`${MEAL_LABEL[m.mealType as MealType]} · ${formatTime(m.createdAt)}`}
                  title={m.title}
                  kcal={m.kcal}
                />
              ))
            ) : (
              <Card>
                <Text color={colors.ink3}>Nothing logged this day.</Text>
              </Card>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const BAR_H = 150;

/** Brand = within target, ink = over, grey stub = not logged, faded = today so far; dashed target line. */
function DailyBars({
  days,
  range,
  selected,
  onSelect,
}: {
  days: HistoryDay[];
  range: number;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const targets = days.map((d) => d.target ?? 0);
  const max = Math.max(...days.map((d) => d.kcal), ...targets, 1) * 1.1;
  const typicalTarget = targets.filter(Boolean).at(-1) ?? 0;
  const over = days.filter((d) => d.logged && d.target && d.kcal > d.target).length;
  const summary = `${days.filter((d) => d.logged).length} of ${range} days logged; ${over} over target. Target ${formatInt(typicalTarget)} kcal.`;

  return (
    <Card accessibilityLabel={`Daily calories. ${summary}`}>
      <View style={{ height: BAR_H }}>
        {typicalTarget > 0 && (
          <View pointerEvents="none" style={[styles.target, { bottom: (typicalTarget / max) * BAR_H }]}>
            <Text weight={600} size={11} color={colors.ink3} tabular style={styles.targetLabel}>
              {formatInt(typicalTarget)}
            </Text>
          </View>
        )}
        <View style={[StyleSheet.absoluteFill, { flexDirection: "row", alignItems: "flex-end", gap: range === 7 ? 12 : 3 }]}>
          {days.map((d) => {
            const isOver = d.logged && d.target != null && d.kcal > d.target;
            const h = d.logged ? Math.max(6, (d.kcal / max) * BAR_H) : 6;
            const isSelected = d.date === selected;
            return (
              <Pressable
                key={d.date}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${dayLabel(d.date, { weekday: "long", day: "numeric", month: "short" })}: ${
                  d.logged ? `${formatInt(d.kcal)} kcal${d.isToday ? " so far" : ""}${isOver ? ", over target" : ""}` : "not logged"
                }`}
                onPress={() => onSelect(d.date)}
                style={{ flex: 1, height: "100%", justifyContent: "flex-end" }}
              >
                <View
                  style={{
                    height: h,
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                    backgroundColor: !d.logged ? colors.line : isOver ? colors.ink : colors.brand,
                    opacity: d.isToday && d.logged ? 0.45 : 1,
                    ...(isSelected ? { outlineWidth: 2, outlineColor: colors.ink, outlineOffset: 2, outlineStyle: "solid" } : null),
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
      {range === 7 && (
        <View style={{ flexDirection: "row", gap: 12 }} aria-hidden>
          {days.map((d) => (
            <Text key={d.date} weight={600} size={11} color={colors.ink3} center style={{ flex: 1 }}>
              {dayLabel(d.date, { weekday: "narrow" })}
            </Text>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 4 }} aria-hidden>
        <Legend color={colors.brand} label="Within target" />
        <Legend color={colors.ink} label="Over" />
        <Legend color={colors.line} label="Not logged" />
        <Legend color={colors.brand} faded label="Today so far" />
      </View>
    </Card>
  );
}

function Legend({ color, label, faded }: { color: string; label: string; faded?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, opacity: faded ? 0.45 : 1 }} />
      <Text weight={600} size={12} color={colors.ink3}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, borderRadius: radius.card, backgroundColor: colors.surface, padding: 12 },
  target: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(107,110,118,0.6)",
  },
  targetLabel: { position: "absolute", right: 0, top: -20 },
});
