import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui";
import { palettes, useColors, useShadows } from "@/lib/theme";

const MODES = [
  { key: "type", label: "Type", pathname: "/log/type" },
  // No barcode mode: the camera opens a product as soon as it reads its barcode.
  { key: "photo", label: "Photo", pathname: "/log" },
] as const;

/** The camera bar's white pill stays white in both schemes, so its label stays dark. */
const INK_ON_WHITE = palettes.light.ink;

export type LogMode = (typeof MODES)[number]["key"];

/** Design 7: bottom pill tabs to switch how a meal is logged. The current mode is the white pill. */
export function ModeTabs({
  current,
  params,
  tone = "dark",
}: {
  current: LogMode;
  /** The meal and day picked so far, carried to the next mode. */
  params: { meal?: string; date?: string };
  tone?: "dark" | "light";
}) {
  const c = useColors();
  const shadows = useShadows();
  const dark = tone === "dark";
  return (
    <View
      accessibilityLabel="How to log"
      style={[styles.bar, { backgroundColor: dark ? "rgba(255,255,255,0.12)" : c.chip }]}
    >
      {MODES.map((m) => {
        const active = m.key === current;
        return (
          <Pressable
            key={m.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => !active && router.replace({ pathname: m.pathname, params })}
            style={[
              styles.tab,
              active && { backgroundColor: dark ? c.white : c.surface },
              active && !dark && shadows.seg,
            ]}
          >
            <Text
              weight={600}
              size={14}
              color={active ? (dark ? INK_ON_WHITE : c.ink) : dark ? "rgba(255,255,255,0.8)" : c.ink2}
            >
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
