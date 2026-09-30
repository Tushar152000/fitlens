import { Check } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { colors, radius } from "@/lib/theme";
import { Text } from "./text";

/** Protein-soft card explaining a change: bold headline + one-line reason with the numbers. */
export function InsightCard({ headline, reason }: { headline: ReactNode; reason: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        borderRadius: radius.card,
        backgroundColor: colors.proteinSoft,
        padding: 16,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.protein,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={16} color={colors.white} strokeWidth={2.5} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight={700}>{headline}</Text>
        <Text size={13} color={colors.ink2}>
          {reason}
        </Text>
      </View>
    </View>
  );
}
