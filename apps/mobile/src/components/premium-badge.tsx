import { Crown } from "lucide-react-native";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { makeStyles, useColors } from "@/lib/theme";

/**
 * The small "Premium" mark for Premium users (docs/DESIGN.md "Premium touches"): a brand crown and
 * label on the soft brand tint. Quiet on purpose: it confirms the plan, it doesn't decorate.
 */
export function PremiumBadge({ label = "Premium", size = "sm" }: { label?: string; size?: "sm" | "md" }) {
  const c = useColors();
  const styles = useStyles();
  const md = size === "md";
  return (
    <View style={[styles.badge, md && styles.md]} accessibilityLabel={`FITR8 ${label}`}>
      <Crown size={md ? 14 : 12} color={c.brandText} strokeWidth={2.4} />
      <Text weight={700} size={md ? 13 : 12} color={c.brandText}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: c.brandSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  md: { paddingHorizontal: 10, paddingVertical: 3, gap: 5 },
}));
