import { Pressable, StyleSheet, View } from "react-native";
import { colors, shadows } from "@/lib/theme";
import { Text } from "./text";

/** Sunken track; the selected option is a raised surface. */
export function Segmented<T extends string | number>({
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
    <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text weight={600} color={selected ? colors.ink : colors.ink2}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", borderRadius: 14, backgroundColor: colors.chip, padding: 4 },
  option: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  selected: { backgroundColor: colors.surface, ...shadows.seg },
});
