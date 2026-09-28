import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { formatInt } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Text } from "./text";

const R = 68;
const STROKE = 14;
const SIZE = R * 2 + STROKE;
const CIRC = 2 * Math.PI * R;

/**
 * Calories ring: brand arc for eaten, centre shows what's left ("kcal to go" before anything is
 * logged). Over target the ring completes in ink with a grey arc for the overflow — never red.
 */
export function CalorieRing({ eaten, target, size = 172 }: { eaten: number; target: number; size?: number }) {
  const left = Math.round(target - eaten);
  const over = left < 0;
  const fraction = target > 0 ? Math.min(1, Math.max(0, eaten / target)) : 0;
  const overflow = over && target > 0 ? Math.min(1, -left / target) : 0;
  const empty = eaten <= 0;
  const label = over
    ? `${formatInt(-left)} kcal over target of ${formatInt(target)}`
    : `${formatInt(left)} of ${formatInt(target)} kcal left`;
  const c = SIZE / 2;

  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={c} cy={c} r={R} fill="none" strokeWidth={STROKE} stroke={colors.track} />
        {fraction > 0 && (
          <Circle
            cx={c}
            cy={c}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={CIRC * (1 - fraction)}
            stroke={over ? colors.ink : colors.brand}
          />
        )}
        {over && (
          <Circle
            cx={c}
            cy={c}
            r={R}
            fill="none"
            strokeWidth={STROKE - 6}
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={CIRC * (1 - overflow)}
            stroke={colors.lineStrong}
          />
        )}
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.centre}>
          <Text variant="h1" size={size > 160 ? 32 : 28} tabular>
            {formatInt(Math.abs(left))}
          </Text>
          <Text variant="meta">{over ? "kcal over" : empty ? "kcal to go" : "kcal left"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
});
