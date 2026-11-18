import { View } from "react-native";
import { Chip, Text } from "@/components/ui";
import { MEAL_LABEL, MEAL_TYPES, type MealType } from "@/lib/format";
import { dayLabel } from "@/lib/meal-param";
import { useColors } from "@/lib/theme";

/**
 * The meal chips, always in view: one is already selected (the slot for the time of day, or the one
 * the route asked for), so logging never waits on it and one tap changes it. The day is never asked:
 * it is the day the user was on in Today (swiped back to yesterday → yesterday), shown as a note on a
 * past day. Used by every way of logging a meal, and by a logged meal to move it.
 */
export function MealWhen({
  mealType,
  onMealType,
  date = null,
  tone = "light",
  gutter = 0,
}: {
  mealType: MealType;
  onMealType: (m: MealType) => void;
  /** The day being logged (null = today); read-only, from the route. */
  date?: string | null;
  tone?: "light" | "dark";
  /** Horizontal padding of the screen. */
  gutter?: number;
}) {
  const c = useColors();
  const past = date ? dayLabel(date) : null;
  return (
    <View style={{ gap: 8, paddingHorizontal: gutter }}>
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
        accessibilityRole="radiogroup"
        accessibilityLabel="Which meal"
      >
        {MEAL_TYPES.map((t) => (
          <Chip key={t} tone={tone} selected={t === mealType} onPress={() => onMealType(t)}>
            {MEAL_LABEL[t]}
          </Chip>
        ))}
      </View>
      {past && (
        <Text weight={600} size={13} color={tone === "dark" ? c.white : c.brandText}>
          {past === "Yesterday" ? "Logging for yesterday" : `Logging for ${past}`}
        </Text>
      )}
    </View>
  );
}
