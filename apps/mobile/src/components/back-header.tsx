import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useColors } from "@/lib/theme";

/** 44 px back button with optional content (progress steps, a title) beside it. */
export function BackHeader({ onBack, children, dark }: { onBack?: () => void; children?: ReactNode; dark?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
        style={{ width: 44, height: 44, marginLeft: -12, alignItems: "center", justifyContent: "center" }}
      >
        <ChevronLeft size={26} color={dark ? c.white : c.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
