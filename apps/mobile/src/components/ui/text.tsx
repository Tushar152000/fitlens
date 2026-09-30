import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { colors, fonts } from "@/lib/theme";

type Variant = "display" | "h1" | "h2" | "body" | "meta" | "label" | "button";

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display700, fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  h1: { fontFamily: fonts.display700, fontSize: 28, lineHeight: 33, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.display700, fontSize: 19, lineHeight: 24 },
  body: { fontFamily: fonts.sans400, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  meta: { fontFamily: fonts.sans600, fontSize: 13, lineHeight: 18, letterSpacing: 0, color: colors.ink3 },
  label: { fontFamily: fonts.sans600, fontSize: 13, lineHeight: 18, letterSpacing: 0, color: colors.ink2 },
  button: { fontFamily: fonts.sans600, fontSize: 16, lineHeight: 20, letterSpacing: 0 },
};

const WEIGHTS = {
  400: fonts.sans400,
  500: fonts.sans500,
  600: fonts.sans600,
  700: fonts.sans700,
} as const;

export interface AppTextProps extends TextProps {
  variant?: Variant;
  /** Figtree weight; ignored for display/h1/h2. */
  weight?: keyof typeof WEIGHTS;
  size?: number;
  color?: string;
  /** Tabular numbers, for anything that shows figures. */
  tabular?: boolean;
  center?: boolean;
}

/** All text in the app goes through this, so fonts and colours stay on the design tokens. */
export function Text({ variant = "body", weight, size, color, tabular, center, style, ...props }: AppTextProps) {
  const base = VARIANTS[variant];
  const display = variant === "display" || variant === "h1" || variant === "h2";
  return (
    <RNText
      {...props}
      style={[
        { color: colors.ink },
        base,
        weight && !display ? { fontFamily: WEIGHTS[weight] } : null,
        size ? { fontSize: size, lineHeight: Math.round(size * (display ? 1.15 : 1.4)) } : null,
        color ? { color } : null,
        tabular ? { fontVariant: ["tabular-nums"] } : null,
        center ? { textAlign: "center" } : null,
        style,
      ]}
    />
  );
}
