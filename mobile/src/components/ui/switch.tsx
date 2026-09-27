import { Pressable, StyleSheet, View } from "react-native";
import { colors, shadows } from "@/lib/theme";

/** 48×28 switch, brand when on. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      hitSlop={8}
      style={[styles.track, { backgroundColor: checked ? colors.brand : colors.lineStrong }]}
    >
      <View style={[styles.knob, { transform: [{ translateX: checked ? 20 : 0 }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 48, height: 28, borderRadius: 14, padding: 2, justifyContent: "center" },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, ...shadows.seg },
});
