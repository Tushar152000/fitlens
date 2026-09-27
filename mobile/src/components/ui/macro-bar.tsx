import { StyleSheet, View } from "react-native";
import { formatInt } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Text } from "./text";

export type Macro = "protein" | "carbs" | "fat";

const FILL: Record<Macro, string> = { protein: colors.protein, carbs: colors.carbs, fat: colors.fat };
const LABEL: Record<Macro, string> = { protein: "Protein", carbs: "Carbs", fat: "Fat" };

/** Label + "74 / 148 g" row over an 8 px bar. The text value is always shown. */
export function MacroBar({ macro, eaten, target }: { macro: Macro; eaten: number; target: number }) {
  const pct = target > 0 ? Math.min(100, (eaten / target) * 100) : 0;
  return (
    <View
      style={{ gap: 6 }}
      accessible
      accessibilityLabel={`${LABEL[macro]}: ${formatInt(eaten)} of ${formatInt(target)} grams`}
    >
      <View style={styles.row}>
        <Text weight={600} size={13}>
          {LABEL[macro]}
        </Text>
        <Text weight={600} size={13} color={colors.ink2} tabular>
          {formatInt(eaten)} / {formatInt(target)} g
        </Text>
      </View>
      <View style={styles.track}>
        {/* Over target fills ink, never red (design 6c). */}
        <View
          style={[
            styles.fill,
            { width: `${pct}%`, backgroundColor: eaten > target && target > 0 ? colors.ink : FILL[macro] },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
});
