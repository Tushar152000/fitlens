import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui";
import type { MealType } from "@/lib/format";
import { colors, shadows } from "@/lib/theme";

const MODES = [
  { key: "type", label: "Type", pathname: "/log/type" },
  { key: "photo", label: "Photo", pathname: "/log" },
  { key: "barcode", label: "Barcode", pathname: "/log/barcode" },
] as const;

export type LogMode = (typeof MODES)[number]["key"];

/** Design 7: bottom pill tabs to switch how a meal is logged. The current mode is the white pill. */
export function ModeTabs({
  current,
  mealType,
  tone = "dark",
}: {
  current: LogMode;
  mealType: MealType;
  tone?: "dark" | "light";
}) {
  const dark = tone === "dark";
  return (
    <View
      accessibilityLabel="How to log"
      style={[styles.bar, { backgroundColor: dark ? "rgba(255,255,255,0.12)" : colors.chip }]}
    >
      {MODES.map((m) => {
        const active = m.key === current;
        return (
          <Pressable
            key={m.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => !active && router.replace({ pathname: m.pathname, params: { meal: mealType } })}
            style={[
              styles.tab,
              active && { backgroundColor: dark ? colors.white : colors.surface },
              active && !dark && shadows.seg,
            ]}
          >
            <Text weight={600} size={14} color={active ? colors.ink : dark ? "rgba(255,255,255,0.8)" : colors.ink2}>
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignSelf: "center", gap: 4, borderRadius: 999, padding: 4 },
  tab: {
    minHeight: 44,
    minWidth: 80,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
