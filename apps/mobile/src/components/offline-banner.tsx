import { useNetInfo } from "@react-native-community/netinfo";
import { WifiOff } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { colors } from "@/lib/theme";

/** "You're offline" strip at the top while the phone has no connection. */
export function OfflineBanner() {
  const { isConnected } = useNetInfo();
  const insets = useSafeAreaInsets();
  if (isConnected !== false) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        right: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: 12,
        borderRadius: 14,
        backgroundColor: colors.ink,
      }}
    >
      <WifiOff size={18} color={colors.white} />
      <Text size={13} weight={600} color={colors.white}>
        You&apos;re offline — we&apos;ll sync when you&apos;re back
      </Text>
    </View>
  );
}
