import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse } from "react-native-svg";
import { Text } from "@/components/ui";
import { colors, radius } from "@/lib/theme";

const CHIPS: { label: string; detail: string; pos: ViewStyle }[] = [
  { label: "Roti", detail: "2 pcs · 211 kcal", pos: { top: "8%", left: -4 } },
  { label: "Dal tadka", detail: "1 katori · 180 kcal", pos: { top: "42%", right: -4 } },
  { label: "Jeera rice", detail: "1 katori · 225 kcal", pos: { bottom: "6%", left: "6%" } },
];

const RICE = [
  [84, 134],
  [98, 130],
  [110, 140],
  [90, 148],
  [104, 150],
];

/** Top-down thali drawn in SVG with detection chips — shows what the app does without a stock photo. */
export function HeroPlate({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size, alignSelf: "center" }} aria-hidden>
      <Svg viewBox="0 0 200 200" width={size} height={size}>
        <Circle cx="100" cy="100" r="92" fill="#FFFFFF" />
        <Circle cx="100" cy="100" r="92" fill="none" stroke="#E3E3EA" strokeWidth="2" />
        <Circle cx="100" cy="100" r="76" fill="none" stroke="#ECECF2" strokeWidth="2" />
        <Circle cx="70" cy="66" r="30" fill="#E9C58E" />
        <Circle cx="70" cy="66" r="30" fill="none" stroke="#D7A968" strokeWidth="1.5" />
        <Circle cx="62" cy="58" r="4" fill="#C98F4A" opacity={0.55} />
        <Circle cx="80" cy="74" r="3" fill="#C98F4A" opacity={0.5} />
        <Circle cx="70" cy="80" r="2.5" fill="#C98F4A" opacity={0.45} />
        <Circle cx="138" cy="86" r="26" fill="#D4D4DE" />
        <Circle cx="138" cy="86" r="21" fill="#E3A13B" />
        <Circle cx="132" cy="80" r="3" fill="#2F6B4F" opacity={0.7} />
        <Circle cx="144" cy="90" r="2" fill="#8116E0" opacity={0.6} />
        <Ellipse cx="96" cy="140" rx="34" ry="22" fill="#FAFAFC" />
        <Ellipse cx="96" cy="140" rx="34" ry="22" fill="none" stroke="#E3E3EA" strokeWidth="1.5" />
        {RICE.map(([x, y]) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#6B6E76" opacity={0.45} />
        ))}
        <Circle cx="146" cy="138" r="14" fill="#2F6B4F" opacity={0.85} />
        <Circle cx="142" cy="134" r="4" fill="#A855F7" />
      </Svg>
      {CHIPS.map((c) => (
        <View key={c.label} style={[styles.chip, c.pos]}>
          <Text weight={700} size={13}>
            {c.label}
          </Text>
          <Text weight={600} size={12} color={colors.ink3} tabular>
            {c.detail}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: "absolute",
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
