import { useQuery } from "@tanstack/react-query";
import { GoalCardSkeleton } from "@/components/skeletons";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { ChevronRight, Crown, Download, Flame, LogOut, Pencil, Trash2 } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Sheet } from "@/components/sheet";
import { Button, FieldError, Screen, Switch, Text } from "@/components/ui";
import { api, apiText } from "@/lib/api";
import { useAuth, useMe } from "@/lib/auth";
import { formatInt } from "@/lib/format";
import { dayQuery, waterQuery } from "@/lib/queries";
import {
  ensureNotificationPermission,
  remindersAvailable,
  sendReminderConfirmation,
  syncWaterReminders,
} from "@/lib/reminders";
import { queryClient } from "@/lib/query";
import { colors, fonts, radius } from "@/lib/theme";
import type { PlanResponse } from "@/lib/types-plan";
import type { UsageDto } from "@fitlens/contracts";

const GOAL_LABEL = { FAT_LOSS: "Lose fat", MUSCLE_GAIN: "Build muscle", RECOMPOSITION: "Recomposition" } as const;
const DIET_LABEL = { VEG: "Veg", NON_VEG: "Non-veg", EGGETARIAN: "Eggetarian", VEGAN: "Vegan" } as const;
const WHERE_LABEL = { FULL_GYM: "Gym", DUMBBELLS: "Home", BODYWEIGHT: "Anywhere" } as const;
const ACTIVITY_LABEL = {
  SEDENTARY: "Mostly sitting",
  LIGHT: "Lightly active",
  MODERATE: "Moderately active",
  VERY_ACTIVE: "Very active",
  ATHLETE: "Athlete",
} as const;

const date = (ymd: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(ymd),
  );

/** Screen 13: profile and settings. */
export default function ProfileScreen() {
  const me = useMe();
  const { signOut } = useAuth();
  const plan = useQuery({ queryKey: ["plan"], queryFn: () => api<PlanResponse>("/api/plan") });
  const usage = useQuery({ queryKey: ["usage"], queryFn: () => api<UsageDto>("/api/usage") });
  const day = useQuery(dayQuery);
  const profile = me.profile!;
  const goal = plan.data?.goal;
  const target = plan.data?.summary.target;
  const metric = plan.data?.metric;
  const streak = day.data?.streak ?? 0;

  const goalLine = goal
    ? goal.targetBodyFatPct != null
      ? `${goal.targetBodyFatPct}% body fat by ${date(goal.targetDate)}`
      : goal.targetWeightKg != null
        ? `${goal.targetWeightKg} kg by ${date(goal.targetDate)}`
        : `Hold weight, improve shape by ${date(goal.targetDate)}`
    : "No active goal";

  return (
    <Screen
      tabBar
      refreshing={plan.isRefetching}
      onRefresh={() => {
        plan.refetch();
        usage.refetch();
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        {me.image ? (
          <Image source={{ uri: me.image }} style={styles.avatar} />
        ) : (
          <View
            style={[styles.avatar, { backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }]}
          >
            <Text variant="h1" size={24} color={colors.white}>
              {(me.name ?? me.email ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text variant="h1" size={26} numberOfLines={1}>
            {me.name ?? "Your profile"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <View style={styles.planPill}>
              <Text weight={600} size={13} color={colors.ink2}>
                Free plan
              </Text>
            </View>
            {streak > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Flame size={16} color={colors.brandGlow} fill={colors.brandGlow} />
                <Text weight={600} size={13} color={colors.ink3}>
                  {streak}-day streak
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {plan.isPending ? (
        <GoalCardSkeleton />
      ) : (
        <View style={styles.goal} accessibilityLabel="Current goal">
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text weight={600} size={13} color="rgba(255,255,255,0.7)">
                Current goal
              </Text>
              <Text variant="h1" size={24} color={colors.white}>
                {goal ? GOAL_LABEL[goal.type] : "—"}
              </Text>
              <Text size={13} color="rgba(255,255,255,0.75)">
                {goalLine}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push("/onboarding")} style={styles.edit}>
              <Pencil size={16} color={colors.white} />
              <Text weight={600} size={13} color={colors.white}>
                Edit
              </Text>
            </Pressable>
          </View>
          {target && (
            <View style={styles.goalFoot}>
              <Text size={13} color="rgba(255,255,255,0.75)" tabular>
                <Text weight={700} size={13} color={colors.white}>
                  {formatInt(target.kcal)} kcal
                </Text>{" "}
                a day · P {target.proteinG} g · C {target.carbsG} g · F {target.fatG} g
              </Text>
            </View>
          )}
        </View>
      )}

      <Group title="Body">
        <Row label="Height" value={`${profile.heightCm} cm`} />
        <Row
          label="Weight"
          value={metric ? `${metric.weightKg} kg` : "—"}
          sub={metric ? `on ${date(metric.date)}` : undefined}
        />
        <Row
          label="Body fat"
          value={metric?.bodyFatPct != null ? `${Math.round(metric.bodyFatPct * 10) / 10}%` : "—"}
        />
        <Row label="Activity" value={ACTIVITY_LABEL[profile.activityLevel]} />
      </Group>

      <Group title="Food and training">
        <Row label="Diet" value={DIET_LABEL[profile.dietType]} />
        <Row label="Where I train" value={WHERE_LABEL[profile.equipment]} />
        <Row label="Sessions" value={`${profile.trainingDaysPerWeek} a week · ${profile.sessionMinutes} min`} />
        <LinkRow label="Edit body and training" onPress={() => router.push("/onboarding")} />
      </Group>

      <Group title="Reminders">
        <Reminders lunch={profile.remindLunch} dinner={profile.remindDinner} water={profile.remindWater ?? false} />
      </Group>

      {usage.data && <PlanCard usage={usage.data} />}

      <Group title="Your data">
        <ExportRow />
      </Group>

      <Button variant="secondary" icon={LogOut} onPress={signOut}>
        Sign out
      </Button>

      <DangerZone onDeleted={signOut} />

      <Text size={12} color={colors.ink3} center>
        {me.email} · FitLens gives general fitness guidance, not medical advice.
      </Text>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children.flat().filter(Boolean) : [children];
  return (
    <View style={{ gap: 8 }} accessibilityLabel={title}>
      <Text variant="h2">{title}</Text>
      <View style={styles.group}>
        {items.map((child, i) => (
          <View key={i} style={i > 0 && styles.divider}>
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.row}>
      <Text color={colors.ink2}>{label}</Text>
      <View style={{ alignItems: "flex-end" }}>
        <Text weight={600} tabular>
          {value}
        </Text>
        {sub && (
          <Text size={12} color={colors.ink3}>
            {sub}
          </Text>
        )}
      </View>
    </View>
  );
}

function LinkRow({ label, icon, onPress }: { label: string; icon?: ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon}
        <Text weight={600}>{label}</Text>
      </View>
      <ChevronRight size={20} color={colors.ink3} />
    </Pressable>
  );
}

/** Design 13 reminder switches, saved as you toggle. */
function Reminders({ lunch, dinner, water }: { lunch: boolean; dinner: boolean; water: boolean }) {
  const { refresh } = useAuth();
  const [state, setState] = useState({ lunch, dinner, water });
  const [error, setError] = useState<string | null>(null);
  const [nextWater, setNextWater] = useState<Date | null>(null);

  // Show when the next water reminder is due (also re-schedules them from today's progress).
  useEffect(() => {
    if (!state.water) return; // the line is hidden while off
    queryClient
      .fetchQuery(waterQuery)
      .then((day) => syncWaterReminders({ enabled: true, leftMl: day.targetMl - day.consumedMl }))
      .then(setNextWater)
      .catch(() => {});
  }, [state.water]);

  async function toggle(key: "lunch" | "dinner" | "water", value: boolean) {
    setError(null);
    if (key === "water" && value && !remindersAvailable) {
      // Save the choice anyway: it takes effect in the installed app.
      setError("Water reminders need the installed app. Expo Go on Android can't show them.");
    } else if (key === "water" && value && !(await ensureNotificationPermission())) {
      setError("Allow notifications for FitLens in your phone's Settings to get water reminders.");
      return;
    }
    setState((s) => ({ ...s, [key]: value }));
    try {
      await api("/api/profile/reminders", { method: "PATCH", json: { [key]: value } });
      refresh().catch(() => {}); // so the switch shows the saved value next time
      if (key === "water") {
        // Schedules (or clears) the phone's reminders from today's progress.
        const day = await queryClient.fetchQuery({ ...waterQuery, staleTime: 0 });
        const next = await syncWaterReminders({ enabled: value, leftMl: day.targetMl - day.consumedMl });
        setNextWater(next);
        if (value) await sendReminderConfirmation(next);
      }
    } catch {
      setState((s) => ({ ...s, [key]: !value }));
      setError("Couldn't save. Try again.");
    }
  }

  return (
    <>
      {(
        [
          ["water", "Water reminders", "Every 2 hours, 9 am–9 pm, until you hit today's target"],
          ["lunch", "Lunch reminder", "2 pm, if lunch isn't logged"],
          ["dinner", "Dinner reminder", "9 pm, if dinner isn't logged"],
        ] as const
      ).map(([key, label, sub]) => (
        <View key={key} style={[styles.row, { minHeight: 56 }]}>
          <View style={{ flex: 1 }}>
            <Text weight={600}>{label}</Text>
            <Text size={13} color={colors.ink3}>
              {sub}
            </Text>
            {key === "water" && state.water && nextWater && (
              <Text weight={600} size={13} color={colors.water}>
                Next reminder: {formatNext(nextWater)}
              </Text>
            )}
          </View>
          <Switch checked={state[key]} onChange={(v) => toggle(key, v)} label={label} />
        </View>
      ))}
      {error && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <FieldError>{error}</FieldError>
        </View>
      )}
    </>
  );
}

const formatNext = (d: Date) => {
  const today = new Date().toDateString() === d.toDateString();
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(d);
  return today ? `today, ${time}` : `${new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(d)}, ${time}`;
};

/** Plan card: free scans left today + Go Pro. */
function PlanCard({ usage }: { usage: UsageDto }) {
  const [note, setNote] = useState(false);
  const pips = Math.min(usage.limit, 10);
  const usedPips = Math.min(pips, Math.round((usage.used / usage.limit) * pips));
  return (
    <View style={styles.planCard} accessibilityLabel="Your plan">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text weight={600}>Free plan</Text>
        <Text weight={600} size={13} color={colors.ink3} tabular>
          {usage.left} of {usage.limit} photo scans left today
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }} aria-hidden>
        {Array.from({ length: pips }, (_, i) => (
          <View
            key={i}
            style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < usedPips ? colors.brand : colors.track }}
          />
        ))}
      </View>
      <Text size={13} color={colors.ink3}>
        Typing meals and relogging usuals are always free.
      </Text>
      <Button variant="strong" icon={Crown} onPress={() => setNote(true)}>
        Go Pro
      </Button>
      {note && (
        <Text size={13} color={colors.ink3} center>
          Pro isn&apos;t available yet.
        </Text>
      )}
    </View>
  );
}

/** Design 13 "Export CSV": written to a cache file and handed to the share sheet. */
function ExportRow() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportCsv() {
    setBusy(true);
    setError(null);
    try {
      const csv = await apiText("/api/export");
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        Object.assign(document.createElement("a"), { href: url, download: "fitlens-export.csv" }).click();
        return;
      }
      const file = new File(Paths.cache, "fitlens-export.csv");
      if (file.exists) file.delete();
      file.create();
      file.write(csv);
      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        UTI: "public.comma-separated-values-text",
        dialogTitle: "Export FitLens data",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't export. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <LinkRow
        label={busy ? "Preparing…" : "Export as CSV"}
        icon={<Download size={20} color={colors.ink2} />}
        onPress={exportCsv}
      />
      {error && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <FieldError>{error}</FieldError>
        </View>
      )}
    </>
  );
}

/** Delete account (danger text), with a typed confirmation. */
function DangerZone({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/account", { method: "DELETE" });
      queryClient.clear();
      onDeleted();
    } catch {
      setError("Couldn't delete your account. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        <Trash2 size={16} color={colors.brand} />
        <Text weight={600} color={colors.brand}>
          Delete account
        </Text>
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <Text color={colors.ink2}>
          This deletes your account, meals, weigh-ins and plan for good. Type DELETE to confirm.
        </Text>
        <TextInput
          accessibilityLabel="Type DELETE to confirm"
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="DELETE"
          placeholderTextColor="rgba(107,110,118,0.6)"
          style={styles.confirm}
        />
        {error && <FieldError>{error}</FieldError>}
        <Button onPress={remove} loading={busy} disabled={typed.trim().toUpperCase() !== "DELETE"}>
          Delete my account
        </Button>
        <Button variant="secondary" onPress={() => setOpen(false)}>
          Keep my account
        </Button>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.sunken },
  planPill: { borderRadius: 999, backgroundColor: colors.chip, paddingHorizontal: 10, paddingVertical: 2 },
  goal: { gap: 12, borderRadius: radius.card, backgroundColor: colors.ink, padding: 20 },
  edit: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
  },
  goalFoot: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 12 },
  group: { borderRadius: radius.card, backgroundColor: colors.surface },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  planCard: { gap: 12, borderRadius: radius.card, backgroundColor: colors.surface, padding: 16 },
  confirm: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.sans600,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.ink,
  },
});
