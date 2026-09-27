import { View } from "react-native";
import { colors } from "@/lib/theme";
import { Text } from "./text";

/** Segmented step indicator with an "N of M" label. `current` is 1-based. */
export function ProgressSteps({ current, total = 4 }: { current: number; total?: number }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${total}`}
    >
      <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < current ? colors.ink : colors.line }}
          />
        ))}
      </View>
      <Text variant="meta" tabular>
        {current} of {total}
      </Text>
    </View>
  );
}
