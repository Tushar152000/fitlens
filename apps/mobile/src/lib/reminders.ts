import { isRunningInExpoGo } from "expo";
import type * as NotificationsModule from "expo-notifications";
import { Platform } from "react-native";

/**
 * Where reminders can run. Not on web, and not in Expo Go on Android: since SDK 53 expo-notifications
 * throws there as soon as it's loaded (it registers for push, which Expo Go on Android dropped), and
 * a top-level import would take every screen that touches reminders down with it. Development and
 * store builds have them.
 */
export const remindersAvailable = !(Platform.OS === "web" || (Platform.OS === "android" && isRunningInExpoGo()));

let loaded: typeof NotificationsModule | null | undefined;

/** The module, loaded on first use only where it works; null elsewhere (every caller degrades to a no-op). */
function notifications(): typeof NotificationsModule | null {
  if (!remindersAvailable) return null;
  if (loaded === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred on purpose, see above
      loaded = require("expo-notifications") as typeof NotificationsModule;
    } catch {
      loaded = null;
    }
  }
  return loaded;
}

/**
 * Water reminders as local notifications (no push server).
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
  const Notifications = notifications();
  if (configured || !Notifications) return;
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
  const Notifications = notifications();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return asked.granted;
}

async function cancelWater(Notifications: typeof NotificationsModule) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** On sign-out / account delete: the next person on this phone must not get the last user's reminders. */
export async function cancelWaterReminders() {
  const Notifications = notifications();
  if (Notifications) await cancelWater(Notifications);
}

/**
 * Bring scheduled water reminders in line with the setting and today's progress.
 * `leftMl` is what's still to drink today (0 or less = target reached, skip today).
 * Returns when the next reminder is due (null when off).
 */
export async function syncWaterReminders({
  enabled,
  leftMl,
}: {
  enabled: boolean;
  leftMl: number;
}): Promise<Date | null> {
  const Notifications = notifications();
  if (!Notifications) return null;
  await cancelWater(Notifications);
  if (!enabled || !(await Notifications.getPermissionsAsync()).granted) return null;

  const now = new Date();
  let next: Date | null = null;
  for (let day = 0; day < DAYS_AHEAD; day++) {
    if (day === 0 && leftMl <= 0) continue;
    for (const hour of HOURS) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, 0, 0);
      if (at <= now) continue;
      next ??= at;
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
  return next;
}

/** One notification a few seconds after switching reminders on, so people see they work. */
export async function sendReminderConfirmation(next: Date | null) {
  const Notifications = notifications();
  if (!Notifications) return;
  const when = next
    ? new Intl.DateTimeFormat("en-IN", {
        weekday: next.getDate() === new Date().getDate() ? undefined : "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(next)
    : null;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Water reminders are on",
      body: when
        ? `Next one at ${when}. We'll stop for the day once you hit your target.`
        : "We'll remind you every 2 hours, 9 am–9 pm.",
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
}

/**
 * The user's own reminders (Reminders screen). The server only stores the rules; the phone repeats
 * the fixed ones (`slots`: daily / weekly / monthly on a date) and schedules changing dates such as
 * "the second-last day of the month" as exact one-off times (`upcoming`), re-planned at every launch.
 */
const CUSTOM_PREFIX = "rem-";

export interface CustomReminder {
  id: string;
  title: string;
  description: string | null;
  summary: string;
  enabled: boolean;
  slots: { day: number | null; weekday: number | null; hour: number; minute: number }[];
  /** Wall-clock "YYYY-MM-DDTHH:mm", local to this phone. */
  upcoming: string[];
}

/** "2026-11-29T18:00" → that moment in this phone's local time. */
export function localDate(at: string): Date {
  const [date, time] = at.split("T");
  const [y, mo, d] = date!.split("-").map(Number);
  const [h, mi] = time!.split(":").map(Number);
  return new Date(y!, mo! - 1, d!, h!, mi!);
}

async function cancelCustom(Notifications: typeof NotificationsModule) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(CUSTOM_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// Syncs run one after another so two quick changes can't interleave cancel/schedule.
let customQueue: Promise<unknown> = Promise.resolve();

/**
 * Make the phone's scheduled reminders match the list: cancel ours, schedule the enabled ones.
 * Returns how many alerts are scheduled (0 without permission or where notifications don't run).
 */
export function syncCustomReminders(reminders: CustomReminder[]): Promise<number> {
  const run = async () => {
    const Notifications = notifications();
    if (!Notifications) return 0;
    await cancelCustom(Notifications);
    if (!(await Notifications.getPermissionsAsync()).granted) return 0;
    const T = Notifications.SchedulableTriggerInputTypes;
    const now = new Date();
    let count = 0;
    for (const r of reminders) {
      if (!r.enabled) continue;
      const content = { title: r.title, body: r.description || r.summary, data: { reminderId: r.id } };
      for (const [i, slot] of r.slots.entries()) {
        const { hour, minute } = slot;
        await Notifications.scheduleNotificationAsync({
          identifier: `${CUSTOM_PREFIX}${r.id}-${i}`,
          content,
          trigger:
            slot.day !== null
              ? { type: T.MONTHLY, day: slot.day, hour, minute, channelId: CHANNEL }
              : slot.weekday !== null
                ? // expo-notifications counts weekdays 1 (Sunday) … 7; ours are 0 (Sunday) … 6.
                  { type: T.WEEKLY, weekday: slot.weekday + 1, hour, minute, channelId: CHANNEL }
                : { type: T.DAILY, hour, minute, channelId: CHANNEL },
        });
        count++;
      }
      for (const at of r.upcoming) {
        const date = localDate(at);
        if (date <= now) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: `${CUSTOM_PREFIX}${r.id}-at-${at}`,
          content,
          trigger: { type: T.DATE, date, channelId: CHANNEL },
        });
        count++;
      }
    }
    return count;
  };
  const next = customQueue.then(run, run);
  customQueue = next.catch(() => undefined);
  return next;
}

/** On sign-out / account delete: the next person on this phone must not get the last user's reminders. */
export async function cancelCustomReminders() {
  const Notifications = notifications();
  if (Notifications) await (customQueue = customQueue.then(() => cancelCustom(Notifications)).catch(() => undefined));
}

/** "granted" | "denied" (ask in Settings) | "undetermined" (we can still ask) | "unavailable". */
export async function notificationStatus(): Promise<"granted" | "denied" | "undetermined" | "unavailable"> {
  const Notifications = notifications();
  if (!Notifications) return "unavailable";
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return "granted";
  return p.canAskAgain ? "undetermined" : "denied";
}
