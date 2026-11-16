import { ScrollView, StyleSheet, View } from "react-native";
import { Chip, Text } from "@/components/ui";
import { MEAL_LABEL, MEAL_TYPES, type MealType } from "@/lib/format";
import { dayLabel, recentDays } from "@/lib/meal-param";
import { colors } from "@/lib/theme";

/**
 * "Which meal?" (always asked: nothing is preselected unless the user came from "Add lunch") and
 * "Which day?" (today, or a forgotten day up to a week back). Used by every way of logging a meal.
 */
export function MealWhen({
  mealType,
  onMealType,
  date,
  onDate,
  tone = "light",
  missing = false,
  gutter = 0,
}: {
  mealType: MealType | null;
  onMealType: (m: MealType) => void;
  /** null = today */
  date: string | null;
  onDate: (d: string | null) => void;
  tone?: "light" | "dark";
  /** The user tried to continue without picking a meal: say so. */
  missing?: boolean;
  /** Horizontal padding of the screen, so the day row can scroll edge to edge. */
  gutter?: number;
}) {
  const days = recentDays();
  const labelColor = tone === "dark" ? "rgba(255,255,255,0.75)" : colors.ink3;
  const alertColor = tone === "dark" ? "#ffb68a" : colors.cautionText;
  return (
    <View style={{ gap: 8 }}>
      <Text weight={600} size={12} color={missing ? alertColor : labelColor} style={{ paddingHorizontal: gutter }}>
        {missing ? "Pick a meal first: breakfast, lunch, snack or dinner" : "Which meal?"}
      </Text>
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
      <Text weight={600} size={12} color={labelColor} style={{ paddingHorizontal: gutter, marginTop: 4 }}>
        Which day?
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, { flexWrap: "nowrap", paddingHorizontal: gutter }]}
        accessibilityLabel="Which day"
      >
        {days.map((d, i) => {
          const value = i === 0 ? null : d;
          return (
            <Chip key={d} tone={tone} selected={value === date} onPress={() => onDate(value)}>
              {dayLabel(d)}
            </Chip>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
