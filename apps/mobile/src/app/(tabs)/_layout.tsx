import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { ReminderPrompt } from "@/components/reminder-prompt";
import { TabBar } from "@/components/tab-bar";
import { remindersQuery } from "@/lib/queries";
import { syncCustomReminders } from "@/lib/reminders";
import { tabMotion } from "@/lib/motion";

/** Today, Workout, [camera], [coach], Profile. Camera and coach are buttons that open stacks (tab-bar.tsx). */
export default function TabsLayout() {
  useReminderSync();
  return (
    <>
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, ...tabMotion }}>
        <Tabs.Screen name="today" />
        <Tabs.Screen name="workout" />
        <Tabs.Screen name="profile" />
      </Tabs>
      {/* Once per install: offer reminders, then the system notification prompt. */}
      <ReminderPrompt />
    </>
  );
}

/**
 * Keeps the phone's scheduled reminders in step with the saved ones: at launch (a new phone, a
 * reinstall, a change made on another device) and whenever the Reminders screen changes the list.
 */
function useReminderSync() {
  const { data } = useQuery({ ...remindersQuery, staleTime: 5 * 60_000 });
  useEffect(() => {
    if (data) syncCustomReminders(data.reminders).catch(() => {});
  }, [data]);
}
