import type { BottomTabBarProps } from "expo-router/tabs";
import { router } from "expo-router";
import { Camera, Dumbbell, House, TrendingUp, UserRound, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { colors, shadows } from "@/lib/theme";

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  today: { label: "Today", icon: House },
  workout: { label: "Workout", icon: Dumbbell },
  progress: { label: "Progress", icon: TrendingUp },
  profile: { label: "Profile", icon: UserRound },
};

/** Five columns with a raised camera button in the middle (design TabBar). 84 px + safe area. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const items = state.routes.filter((r) => TABS[r.name]);
  const cells = [...items.slice(0, 2), null, ...items.slice(2)];

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: 84 + insets.bottom }]}>
      {cells.map((route) => {
        if (!route) {
          return (
            <View key="camera" style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log a meal"
                onPress={() => router.push("/log")}
                style={({ pressed }) => [
                  styles.fab,
                  { backgroundColor: pressed ? colors.brandHover : colors.brand },
                ]}
              >
                <Camera size={24} color={colors.white} strokeWidth={2} />
              </Pressable>
            </View>
          );
        }
        const tab = TABS[route.name];
        const focused = state.routes[state.index]?.key === route.key;
        const color = focused ? colors.ink : colors.ink3;
        const Icon = tab.icon;
        return (
          <View key={route.key} style={styles.cell}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.tab}
            >
              <Icon size={22} color={color} strokeWidth={2} />
              <Text weight={600} size={11} color={color}>
                {tab.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  cell: { flex: 1, alignItems: "center" },
  tab: { minHeight: 44, minWidth: 56, alignItems: "center", gap: 4, paddingTop: 4 },
  fab: {
    marginTop: -26,
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.fab,
  },
});
