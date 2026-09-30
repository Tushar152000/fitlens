import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/lib/theme";
import { Text } from "./text";

/** 36 px pill with a 44 px hit area. Dark tone for the camera screen. */
export function Chip({
  selected,
  tone = "light",
  onPress,
  children,
  icon,
}: {
  selected?: boolean;
  tone?: "light" | "dark";
  onPress?: () => void;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const bg =
    tone === "dark" ? (selected ? colors.white : "rgba(255,255,255,0.12)") : selected ? colors.ink : colors.chip;
  const fg =
    tone === "dark" ? (selected ? colors.ink : "rgba(255,255,255,0.85)") : selected ? colors.white : colors.ink2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={[styles.chip, { backgroundColor: bg, paddingHorizontal: tone === "dark" ? 14 : 16 }]}
    >
      {icon}
      <Text weight={600} size={14} color={fg}>
        {children}
      </Text>
    </Pressable>
  );
}

/** Single-select wrapping row of chips. */
export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group} accessibilityLabel={label}>
      {options.map((o) => (
        <Chip key={String(o.value)} selected={o.value === value} onPress={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { height: 36, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 6 },
  group: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
