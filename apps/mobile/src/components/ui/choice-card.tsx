import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { makeStyles, radius, useColors } from "@/lib/theme";
import { Text } from "./text";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: (color: string) => ReactNode;
}

/** Radio cards. Selected = 2 px brand border and a filled dot. */
export function ChoiceCardGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={[styles.card, selected ? styles.selected : styles.idle]}
          >
            {o.icon && (
              <View style={[styles.icon, { backgroundColor: selected ? c.brandSoft : c.sunken }]}>
                {o.icon(selected ? c.brandText : c.ink2)}
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text weight={600} size={16}>
                {o.label}
              </Text>
              {o.description && (
                <Text size={13} color={c.ink3}>
                  {o.description}
                </Text>
              )}
            </View>
            <View style={[styles.radio, { borderColor: selected ? c.brandText : c.lineStrong }]}>
              {selected && <View style={styles.dot} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.input,
    backgroundColor: c.surface,
  },
  idle: { borderWidth: 1, borderColor: c.lineStrong, paddingHorizontal: 16, paddingVertical: 12 },
  selected: { borderWidth: 2, borderColor: c.brandText, paddingHorizontal: 15, paddingVertical: 11 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.brandText },
}));
