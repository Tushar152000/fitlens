import { View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { colors, fonts } from "@/lib/theme";
import { Text } from "./text";

// The FITR8 mark (Figma node 3788:3999), 19.1 × 18.02 units; same paths as apps/web logo.tsx.
const MARK_PATHS = [
  "M9.34499 8.20513C10.053 8.15165 11.3305 8.18998 12.0866 8.19005L17.3715 8.19142C16.9786 10.3199 16.4415 12.6055 15.9964 14.7441L11.9224 14.7394C11.2924 14.7387 10.1694 14.7039 9.58177 14.7531C9.29751 14.7762 9.01759 14.8347 8.74771 14.9273C7.82001 15.2494 7.22942 15.8698 6.81205 16.7354C6.6231 17.2117 6.59902 17.5247 6.54485 18.0234L0 18.0227C0.137717 12.6658 3.96877 8.55263 9.34499 8.20513Z",
  "M0.00759415 0C2.13514 0.0329772 4.35339 0.00157058 6.48703 0.00153714L19.1009 0C18.7855 1.76759 18.3193 3.67943 17.9582 5.4599C17.8722 5.80108 17.8043 6.19784 17.7368 6.54698C15.3172 6.57538 12.8334 6.54675 10.4082 6.54812L7.8361 6.54919C6.85891 6.54919 5.99041 6.59561 5.03127 6.36852C3.89088 6.09727 2.8448 5.52375 2.00281 4.70825C0.6929 3.43689 0.0348498 1.81385 0.00759415 0Z",
];

/** The FITR8 app icon: white mark on a purple tile (docs/DESIGN.md → Brand). 24–40 px in the UI. */
export function LogoMark({ size = 32 }: { size?: number; onDark?: boolean }) {
  return (
    <Svg viewBox="0 0 512 512" width={size} height={size}>
      <Rect width="512" height="512" rx="116" fill={colors.brand} />
      {/* Mark at 54% of the tile width, centred. */}
      <G transform="translate(117.76 125.56) scale(14.4747)" fill="#FFFFFF">
        {MARK_PATHS.map((d) => (
          <Path key={d} d={d} />
        ))}
      </G>
    </Svg>
  );
}

/** Mark + live wordmark: "FIT" in ink (white on dark), "R8" in brand purple. */
export function Logo({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  const fontSize = Math.round(size * 0.7);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessibilityLabel="FITR8">
      <LogoMark size={size} onDark={onDark} />
      <Text
        style={{ fontFamily: fonts.display700, fontSize, lineHeight: fontSize * 1.1, letterSpacing: -0.02 * fontSize }}
        color={onDark ? colors.white : colors.ink}
      >
        FIT
        <Text style={{ fontFamily: fonts.display700, fontSize }} color={colors.brand}>
          R8
        </Text>
      </Text>
    </View>
  );
}
