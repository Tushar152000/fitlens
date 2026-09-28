import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius } from "@/lib/theme";
import { Text } from "./text";

export type ButtonVariant = "primary" | "strong" | "secondary" | "dashed" | "ghostDark";

const BG: Record<ButtonVariant, [string, string]> = {
  primary: [colors.brand, colors.brandHover],
  strong: [colors.ink, "#2c2e34"],
  secondary: [colors.surface, colors.sunken],
  dashed: ["transparent", "rgba(255,255,255,0.6)"],
  ghostDark: ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.16)"],
};

const FG: Record<ButtonVariant, string> = {
  primary: colors.white,
  strong: colors.white,
  secondary: colors.ink,
  dashed: colors.brand,
  ghostDark: colors.white,
};

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
  const fg = FG[variant];
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
        { height: height ?? (variant === "dashed" ? 48 : 54), backgroundColor: BG[variant][pressed ? 1 : 0] },
        variant === "secondary" && styles.secondary,
        variant === "dashed" && styles.dashed,
        variant === "ghostDark" && styles.ghostDark,
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {Icon && <Icon size={20} color={fg} strokeWidth={2} />}
          {isText(children) ? (
            <Text variant="button" color={fg}>
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

const styles = StyleSheet.create({
  base: {
    width: "100%",
    borderRadius: radius.button,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  secondary: { borderWidth: 1, borderColor: colors.lineStrong },
  dashed: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.dash },
  ghostDark: { borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
});
