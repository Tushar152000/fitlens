import { CircleCheck } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { makeStyles, useColors } from "@/lib/theme";
import Animated from "react-native-reanimated";
import { toastIn, toastOut } from "@/lib/motion";

/** The app-wide toast (lib/toast.ts): a strong pill near the top, read out by screen readers. */
export function Toast() {
  const toast = useToast();
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + 12, pointerEvents: "none" }]}>
      <Animated.View
        key={toast.id}
        entering={toastIn}
        exiting={toastOut}
        style={styles.toast}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <CircleCheck size={18} color={c.onStrong} />
        <Text weight={600} color={c.onStrong}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.strong,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
}));
