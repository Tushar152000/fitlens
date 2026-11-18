import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { makeStyles, radius, useColors, type Colors } from "@/lib/theme";
import { Text } from "./text";

export type ButtonVariant = "primary" | "strong" | "secondary" | "dashed" | "ghostDark" | "danger";

const bg = (c: Colors): Record<ButtonVariant, [string, string]> => ({
  primary: [c.brand, c.brandHover],
  strong: [c.strong, c.strongHover],
  secondary: [c.surface, c.sunken],
  dashed: ["transparent", c.sunken],
  ghostDark: ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.16)"],
  /** Destructive and final (delete account): never the screen's primary action. */
  danger: [c.danger, c.dangerHover],
});

const fg = (c: Colors): Record<ButtonVariant, string> => ({
  primary: c.white,
  strong: c.onStrong,
  secondary: c.ink,
  dashed: c.brandText,
  ghostDark: c.white,
  danger: c.onDanger,
});

/** Full-width 54 px button (48 for dashed), radius 16. One primary per screen. */
export function Button({
  children,
  onPress,
  variant = "primary",
  icon: Icon,
  disabled,
  loading,
  style,
  height,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  height?: number;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const styles = useStyles();
  const color = fg(c)[variant];
  const fills = bg(c)[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { height: height ?? (variant === "dashed" ? 48 : 54), backgroundColor: fills[pressed ? 1 : 0] },
        variant === "secondary" && styles.secondary,
        variant === "dashed" && styles.dashed,
        variant === "ghostDark" && styles.ghostDark,
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View style={styles.row}>
          {Icon && <Icon size={20} color={color} strokeWidth={2} />}
          {isText(children) ? (
            <Text variant="button" color={color}>
              {children}
            </Text>
          ) : (
            children
          )}
        </View>
      )}
    </Pressable>
  );
}

/** Plain text children ("Add ", "dinner") get the button text style. */
function isText(node: ReactNode): boolean {
  if (typeof node === "string" || typeof node === "number") return true;
  return Array.isArray(node) && node.every((n) => typeof n === "string" || typeof n === "number");
}

const useStyles = makeStyles((c) => ({
  base: {
    width: "100%",
    borderRadius: radius.button,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  secondary: { borderWidth: 1, borderColor: c.lineStrong },
  dashed: { borderWidth: 1.5, borderStyle: "dashed", borderColor: c.dash },
  ghostDark: { borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
}));
