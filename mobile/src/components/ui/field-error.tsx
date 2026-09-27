import { CircleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { colors } from "@/lib/theme";
import { Text } from "./text";

/** Form error: ink text with an amber icon (never red). */
export function FieldError({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }} accessibilityLiveRegion="polite">
      <CircleAlert size={16} color={colors.caution} style={{ marginTop: 2 }} />
      <Text size={13} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}
