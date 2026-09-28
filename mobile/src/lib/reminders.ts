import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Water reminders as local notifications (they work in Expo Go and in builds, no push server).
 * Every 2 hours from 9 am to 9 pm. We schedule the next 7 days as one-off notifications and
 * reschedule whenever water changes, so today's remaining ones drop once the target is reached.
 */
const HOURS = [9, 11, 13, 15, 17, 19, 21];
const DAYS_AHEAD = 7;
const CHANNEL = "reminders";
const PREFIX = "water-";

let configured = false;

/** Call once at startup: show reminders while the app is open, and the Android channel. */
export async function configureNotifications() {
  if (configured || Platform.OS === "web") return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Asks once; true when reminders can be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return asked.granted;
}

async function cancelWater() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Bring scheduled water reminders in line with the setting and today's progress.
 * `leftMl` is what's still to drink today (0 or less = target reached, skip today).
 */
export async function syncWaterReminders({ enabled, leftMl }: { enabled: boolean; leftMl: number }) {
  if (Platform.OS === "web") return;
  await cancelWater();
  if (!enabled || !(await Notifications.getPermissionsAsync()).granted) return;

  const now = new Date();
  for (let day = 0; day < DAYS_AHEAD; day++) {
    if (day === 0 && leftMl <= 0) continue;
    for (const hour of HOURS) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, 0, 0);
      if (at <= now) continue;
      const left = day === 0 ? leftMl : null;
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${at.toISOString()}`,
        content: {
          title: "Time for some water",
          body:
            left != null
              ? `A glass (250 ml) now. ${(Math.round(left / 100) / 10).toFixed(1)} L to go today.`
              : "A glass (250 ml) now keeps you on track for today's target.",
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
    }
  }
}
