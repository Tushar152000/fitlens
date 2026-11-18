import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Chip, Text } from "@/components/ui";
import { MEAL_LABEL, MEAL_TYPES, type MealType } from "@/lib/format";
import { dayLabel, recentDays } from "@/lib/meal-param";
import { useColors } from "@/lib/theme";

/**
 * Which meal and which day, kept to one line: the meal starts as the slot for the time of day (or
 * the one the route asked for), so logging never waits on it. "Change" opens the meal and day chips;
 * the meal can also be moved later from the meal's own screen. Used by every way of logging a meal.
 */
export function MealWhen({
  mealType,
  onMealType,
  date = null,
  onDate,
  tone = "light",
  gutter = 0,
  showDay = true,
  prefix = "Adding to",
}: {
  mealType: MealType;
  onMealType: (m: MealType) => void;
  /** null = today. Leave out (with `onDate`) where the day can't change. */
  date?: string | null;
  onDate?: (d: string | null) => void;
  tone?: "light" | "dark";
  /** Horizontal padding of the screen, so the day row can scroll edge to edge. */
  gutter?: number;
  /** false hides the day (the camera keeps it minimal; a day from the route still applies). */
  showDay?: boolean;
  /** Words before the meal: "Adding to" while logging, "Logged as" on a saved meal. */
  prefix?: string;
}) {
  const withDay = showDay && onDate != null;
  const c = useColors();
  const [open, setOpen] = useState(false);
  const dark = tone === "dark";
  const ink = dark ? c.white : c.ink;
  const muted = dark ? "rgba(255,255,255,0.75)" : c.ink3;
  const accent = dark ? c.white : c.brandText;
  const Chevron = open ? ChevronUp : ChevronDown;
  const summary = `${MEAL_LABEL[mealType]}${withDay ? ` · ${date ? dayLabel(date) : "Today"}` : ""}`;

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${prefix} ${summary}. Change`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        hitSlop={8}
        style={[styles.summary, { paddingHorizontal: gutter }]}
      >
        <Text size={13} color={muted}>
          {prefix}{" "}
          <Text weight={600} size={13} color={ink}>
            {summary}
          </Text>
        </Text>
        <View style={styles.change}>
          <Text weight={600} size={13} color={accent}>
            {open ? "Done" : "Change"}
          </Text>
          <Chevron size={16} color={accent} />
        </View>
      </Pressable>

      {open && (
        <>
          <View
            style={[styles.row, { paddingHorizontal: gutter }]}
            accessibilityRole="radiogroup"
            accessibilityLabel="Which meal"
          >
            {MEAL_TYPES.map((t) => (
              <Chip key={t} tone={tone} selected={t === mealType} onPress={() => onMealType(t)}>
                {MEAL_LABEL[t]}
              </Chip>
            ))}
          </View>
          {withDay && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.row, { flexWrap: "nowrap", paddingHorizontal: gutter }]}
              accessibilityLabel="Which day"
            >
              {recentDays().map((d, i) => {
                const value = i === 0 ? null : d;
                return (
                  <Chip key={d} tone={tone} selected={value === date} onPress={() => onDate(value)}>
                    {dayLabel(d)}
                  </Chip>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  change: { flexDirection: "row", alignItems: "center", gap: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
