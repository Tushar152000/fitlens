import { Check } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { radius, useColors } from "@/lib/theme";
import { Text } from "./text";

/** Protein-soft card explaining a change: bold headline + one-line reason with the numbers. */
export function InsightCard({ headline, reason }: { headline: ReactNode; reason: ReactNode }) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        borderRadius: radius.card,
        backgroundColor: c.proteinSoft,
        padding: 16,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: c.protein,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={16} color={c.white} strokeWidth={2.5} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight={700}>{headline}</Text>
        <Text size={13} color={c.ink2}>
          {reason}
        </Text>
      </View>
    </View>
  );
}
