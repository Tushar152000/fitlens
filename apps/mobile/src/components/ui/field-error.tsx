import { CircleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useColors } from "@/lib/theme";
import { Text } from "./text";

/** Form error: ink text with an amber icon (never red). */
export function FieldError({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }} accessibilityLiveRegion="polite">
      <CircleAlert size={16} color={c.caution} style={{ marginTop: 2 }} />
      <Text size={13} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}
