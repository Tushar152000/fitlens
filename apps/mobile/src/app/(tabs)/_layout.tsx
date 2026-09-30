import { Tabs } from "expo-router";
import { TabBar } from "@/components/tab-bar";

/** Today, Workout, [camera], Progress, Profile. */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="workout" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
