import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius } from "@/lib/theme";
import { Text } from "./text";

export interface TileOption<T extends string | number> {
  value: T;
  label: string;
  sub?: string;
  icon?: (color: string) => ReactNode;
}

/** Row of equal radio tiles ("By when?", "Where I train"). Selected = 2 px brand border. */
export function TileGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: TileOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={[styles.tile, selected ? styles.selected : styles.idle]}
          >
            {o.icon?.(selected ? colors.brand : colors.ink2)}
            <Text weight={600} center>
              {o.label}
            </Text>
            {o.sub && (
              <Text weight={500} size={12} color={colors.ink3} tabular center>
                {o.sub}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },
  idle: { borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 8, paddingVertical: 12 },
  selected: { borderWidth: 2, borderColor: colors.brand, paddingHorizontal: 7, paddingVertical: 11 },
});
