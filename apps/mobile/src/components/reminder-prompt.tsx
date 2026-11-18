import * as SecureStore from "expo-secure-store";
import { BellRing } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Sheet } from "@/components/sheet";
import { Button, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth, useMe } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { waterQuery } from "@/lib/queries";
import {
  ensureNotificationPermission,
  notificationStatus,
  remindersAvailable,
  sendReminderConfirmation,
  syncWaterReminders,
} from "@/lib/reminders";
import { useColors } from "@/lib/theme";

/** Asked once per install: after "Turn on" or "Not now" the app never shows this again. */
const KEY = "fitr8.reminderPromptShown";
const alreadyShown = () => {
  try {
    return SecureStore.getItem(KEY) === "1";
  } catch {
    return true; // can't remember the answer: don't risk asking on every launch
  }
};
const remember = () => {
  try {
    SecureStore.setItem(KEY, "1");
  } catch {
    // Not saved: worst case it's offered once more on the next install.
  }
};

/**
 * The first time a signed-in user reaches the app on this phone, offer reminders with the reason
 * up front, and only then show the system notification prompt (a cold system prompt at launch is
 * the one most people refuse). "Turn on" also switches on water reminders, the reminders FITR8
 * sends without any setup; custom reminders are added from Profile. Never shown when the phone has
 * already answered (granted or blocked), when water reminders are already on, or where the app
 * can't show notifications (web preview, Expo Go on Android).
 */
export function ReminderPrompt() {
  const me = useMe();
  const { refresh } = useAuth();
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!remindersAvailable || alreadyShown() || me.profile?.remindWater) return;
    let cancelled = false;
    // A beat after Today appears, so it doesn't land on top of the first frame.
    const timer = setTimeout(() => {
      notificationStatus()
        .then((status) => {
          if (!cancelled && status === "undetermined") setOpen(true);
        })
        .catch(() => {});
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [me.profile?.remindWater]);

  const close = () => {
    remember();
    setOpen(false);
  };

  async function turnOn() {
    setBusy(true);
    setNote(null);
    remember();
    try {
      if (!(await ensureNotificationPermission())) {
        setNote("No problem. You can allow notifications for FITR8 later in your phone's Settings.");
        setBusy(false);
        return;
      }
      await api("/api/profile/reminders", { method: "PATCH", json: { water: true } });
      const day = await queryClient.fetchQuery({ ...waterQuery, staleTime: 0 });
      const next = await syncWaterReminders({ enabled: true, leftMl: day.targetMl - day.consumedMl });
      await sendReminderConfirmation(next);
      refresh().catch(() => {});
      setOpen(false);
    } catch {
      setNote("Notifications are on, but water reminders didn't save. Turn them on in Profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Turn on reminders?">
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <BellRing size={24} color={c.brandText} />
          <Text color={c.ink2} style={{ flex: 1 }}>
            A nudge to drink water every 2 hours (9 am–9 pm, stops once you hit your target), plus any reminders you set
            up yourself, like &ldquo;stretch at 7 pm on weekdays&rdquo;. You can change them anytime in Profile.
          </Text>
        </View>
        {note && (
          <Text size={13} color={c.ink3}>
            {note}
          </Text>
        )}
        <Button onPress={note ? close : turnOn} loading={busy}>
          {note ? "Done" : "Turn on reminders"}
        </Button>
        {!note && (
          <Button variant="secondary" onPress={close} disabled={busy}>
            Not now
          </Button>
        )}
      </View>
    </Sheet>
  );
}
