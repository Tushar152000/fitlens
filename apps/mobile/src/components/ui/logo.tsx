import { View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { colors, fonts } from "@/lib/theme";
import { Text } from "./text";

/** The "Progress lens" mark (docs/DESIGN.md → Brand). 24–40 px in the UI. Never recolour or animate the arc. */
export function LogoMark({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <Svg viewBox="0 0 512 512" width={size} height={size}>
      <Rect width="512" height="512" rx="116" fill={onDark ? "#2A2C33" : "#17181C"} />
      <Circle cx="256" cy="256" r="148" fill="none" stroke="#3A3C43" strokeWidth="60" />
      <Circle
        cx="256"
        cy="256"
        r="148"
        fill="none"
        stroke="#E8772E"
        strokeWidth="60"
        strokeLinecap="round"
        strokeDasharray="669.5 260.4"
        transform="rotate(-90 256 256)"
      />
      <Circle cx="256" cy="256" r="52" fill="#F6F3EC" />
    </Svg>
  );
}

/** Mark + live wordmark "FitLens" (Bricolage Grotesque 700, −0.02em). */
export function Logo({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  const fontSize = Math.round(size * 0.7);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessibilityLabel="FitLens">
      <LogoMark size={size} onDark={onDark} />
      <Text
        style={{ fontFamily: fonts.display700, fontSize, lineHeight: fontSize * 1.1, letterSpacing: -0.02 * fontSize }}
        color={onDark ? colors.white : colors.ink}
      >
        FitLens
      </Text>
    </View>
  );
}
