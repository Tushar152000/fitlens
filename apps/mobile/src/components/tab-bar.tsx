import type { BottomTabBarProps } from "expo-router/tabs";
import { router } from "expo-router";
import { Camera, Dumbbell, House, MessageCircle, UserRound, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { makeStyles, useColors } from "@/lib/theme";
import { useViewDay } from "@/lib/view-day";

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  today: { label: "Today", icon: House },
  workout: { label: "Workout", icon: Dumbbell },
  profile: { label: "Profile", icon: UserRound },
};

type Cell =
  { kind: "tab"; route: BottomTabBarProps["state"]["routes"][number] } | { kind: "camera" } | { kind: "coach" };

/**
 * Today, Workout, [camera], Coach, Profile (design TabBar). 84 px + safe area. Camera and Coach
 * open full-screen stacks (the logger, the chat with its keyboard) rather than tabs.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const styles = useStyles();
  // On Today, the camera logs to the day being shown (swiped back to yesterday → yesterday).
  const viewDay = useViewDay();
  const onToday = state.routes[state.index]?.name === "today";
  const logDay = onToday && viewDay ? { date: viewDay } : {};
  const tabs: Cell[] = state.routes.filter((r) => TABS[r.name]).map((route) => ({ kind: "tab", route }));
  const cells: Cell[] = [...tabs.slice(0, 2), { kind: "camera" }, { kind: "coach" }, ...tabs.slice(2)];

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: 84 + insets.bottom }]}>
      {cells.map((cell) => {
        if (cell.kind === "coach") {
          return (
            <View key="coach" style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ask your coach"
                onPress={() => router.push("/coach")}
                style={styles.tab}
              >
                <MessageCircle size={22} color={c.ink3} strokeWidth={2} />
                <Text weight={600} size={11} color={c.ink3}>
                  Coach
                </Text>
              </Pressable>
            </View>
          );
        }
        if (cell.kind === "camera") {
          return (
            <View key="camera" style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log a meal"
                onPress={() => router.push({ pathname: "/log", params: logDay })}
                style={({ pressed }) => [styles.fab, { backgroundColor: pressed ? c.brandHover : c.brand }]}
              >
                <Camera size={24} color={c.white} strokeWidth={2} />
              </Pressable>
            </View>
          );
        }
        const { route } = cell;
        const tab = TABS[route.name];
        const focused = state.routes[state.index]?.key === route.key;
        const color = focused ? c.ink : c.ink3;
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

const useStyles = makeStyles((c, shadows) => ({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 8,
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.line,
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
}));
