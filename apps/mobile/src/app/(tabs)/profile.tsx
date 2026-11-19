import { useQuery } from "@tanstack/react-query";
import { GoalCardSkeleton } from "@/components/skeletons";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { BellRing, ChevronRight, Crown, Download, Flame, LogOut, Pencil, Trash2 } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Sheet } from "@/components/sheet";
import { Button, Chip, FieldError, Screen, Segmented, Switch, Text } from "@/components/ui";
import { api, apiText } from "@/lib/api";
import { useAuth, useMe } from "@/lib/auth";
import { formatInt, mealTitle } from "@/lib/format";
import { manageSubscriptionUrl } from "@/lib/purchases";
import { billingQuery, dayQuery, remindersQuery, waterQuery } from "@/lib/queries";
import {
  ensureNotificationPermission,
  remindersAvailable,
  sendReminderConfirmation,
  syncWaterReminders,
} from "@/lib/reminders";
import { queryClient } from "@/lib/query";
import { fonts, makeStyles, radius, useAppearance, useColors, type AppearancePreference } from "@/lib/theme";
import type { PlanResponse } from "@/lib/types-plan";
import type { DeleteReason, UsageDto } from "@fitr8/contracts";
import { openLegal } from "@/lib/legal";

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
  const c = useColors();
  const styles = useStyles();
  const me = useMe();
  const { signOut } = useAuth();
  const plan = useQuery({ queryKey: ["plan"], queryFn: () => api<PlanResponse>("/api/plan") });
  const usage = useQuery({ queryKey: ["usage"], queryFn: () => api<UsageDto>("/api/usage") });
  const day = useQuery(dayQuery);
  // Also keeps this phone's scheduled reminders in step (tabs layout shares the query).
  const reminders = useQuery(remindersQuery);
  const reminderCount = reminders.data?.reminders.length ?? 0;
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
          <View style={[styles.avatar, { backgroundColor: c.panel, alignItems: "center", justifyContent: "center" }]}>
            <Text variant="h1" size={24} color={c.white}>
              {(me.name ?? me.email ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text variant="h1" size={26} numberOfLines={1}>
            {[me.name, me.lastName].filter(Boolean).join(" ") || "Your profile"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <View style={styles.planPill}>
              <Text weight={600} size={13} color={c.ink2}>
                {usage.data?.plan === "PRO" ? "FITR8 Premium" : "Free plan"}
              </Text>
            </View>
            {streak > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Flame size={16} color={c.brandGlow} fill={c.brandGlow} />
                <Text weight={600} size={13} color={c.ink3}>
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
              <Text variant="h1" size={24} color={c.white}>
                {goal ? GOAL_LABEL[goal.type] : "—"}
              </Text>
              <Text size={13} color="rgba(255,255,255,0.75)">
                {goalLine}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push("/onboarding")} style={styles.edit}>
              <Pencil size={16} color={c.white} />
              <Text weight={600} size={13} color={c.white}>
                Edit
              </Text>
            </Pressable>
          </View>
          {target && (
            <View style={styles.goalFoot}>
              <Text size={13} color="rgba(255,255,255,0.75)" tabular>
                <Text weight={700} size={13} color={c.white}>
                  {formatInt(target.kcal)} kcal
                </Text>{" "}
                a day · {target.proteinG} g protein · {target.carbsG} g carbs · {target.fatG} g fat
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
        <LinkRow
          label="My reminders"
          sub={
            reminderCount
              ? mealTitle(
                  reminders.data!.reminders.map((r) => r.title),
                  "",
                )
              : "Describe one in words: “stretch at 7 pm on weekdays”"
          }
          icon={<BellRing size={20} color={c.brandText} />}
          onPress={() => router.push("/reminders")}
        />
        <Reminders lunch={profile.remindLunch} dinner={profile.remindDinner} water={profile.remindWater ?? false} />
      </Group>

      <Group title="Appearance">
        <AppearancePicker />
      </Group>

      {usage.data && <PlanCard usage={usage.data} />}

      <Group title="Your data">
        <ExportRow />
      </Group>

      <Button variant="secondary" icon={LogOut} onPress={signOut}>
        Sign out
      </Button>

      <DangerZone onDeleted={signOut} onSignOut={signOut} />

      <Text size={12} color={c.ink3} center>
        {me.email} · FITR8 gives general fitness guidance, not medical advice.
      </Text>
      <Text size={12} color={c.ink3} center>
        <Text size={12} color={c.brandText} weight={600} onPress={() => openLegal("privacy")}>
          Privacy Policy
        </Text>
        {"  ·  "}
        <Text size={12} color={c.brandText} weight={600} onPress={() => openLegal("terms")}>
          Terms
        </Text>
      </Text>
    </Screen>
  );
}

/** System (follow the phone), or always light / always dark. Applies instantly and is remembered. */
function AppearancePicker() {
  const c = useColors();
  const { preference, setPreference } = useAppearance();
  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Segmented<AppearancePreference>
        label="Theme"
        value={preference}
        onChange={setPreference}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
      <Text size={13} color={c.ink3}>
        {preference === "system"
          ? "Matches your phone's light or dark setting."
          : "Stays the same whatever your phone uses."}
      </Text>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
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
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text color={c.ink2}>{label}</Text>
      <View style={{ alignItems: "flex-end" }}>
        <Text weight={600} tabular>
          {value}
        </Text>
        {sub && (
          <Text size={12} color={c.ink3}>
            {sub}
          </Text>
        )}
      </View>
    </View>
  );
}

function LinkRow({
  label,
  sub,
  icon,
  onPress,
}: {
  label: string;
  sub?: string;
  icon?: ReactNode;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon}
        <View style={{ flex: 1 }}>
          <Text weight={600}>{label}</Text>
          {sub && (
            <Text size={13} color={c.ink3}>
              {sub}
            </Text>
          )}
        </View>
      </View>
      <ChevronRight size={20} color={c.ink3} />
    </Pressable>
  );
}

/** Design 13 reminder switches, saved as you toggle. */
function Reminders({ lunch, dinner, water }: { lunch: boolean; dinner: boolean; water: boolean }) {
  const c = useColors();
  const styles = useStyles();
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
      setError("Allow notifications for FITR8 in your phone's Settings to get water reminders.");
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
            <Text size={13} color={c.ink3}>
              {sub}
            </Text>
            {key === "water" && state.water && nextWater && (
              <Text weight={600} size={13} color={c.water}>
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

/** Plan card: scans left today, and FITR8 Premium (upgrade, or renewal + manage). */
function PlanCard({ usage }: { usage: UsageDto }) {
  const c = useColors();
  const styles = useStyles();
  const billing = useQuery({ ...billingQuery, enabled: usage.plan === "PRO" });
  const pips = Math.min(usage.limit, 10);
  const usedPips = Math.min(pips, Math.round((usage.used / usage.limit) * pips));
  const pro = usage.plan === "PRO";
  // Paywall on, free plan: no photo scans at all, so show what Premium adds instead of a 0/0 meter.
  const noScans = usage.limit === 0;
  const until = billing.data?.proUntil
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(billing.data.proUntil),
      )
    : null;
  return (
    <View style={styles.planCard} accessibilityLabel="Your plan">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {pro && <Crown size={16} color={c.brandText} />}
          <Text weight={600}>{pro ? "FITR8 Premium" : "Free plan"}</Text>
        </View>
        {!noScans && (
          <Text weight={600} size={13} color={c.ink3} tabular>
            {usage.left} of {usage.limit} photo scans left today
          </Text>
        )}
      </View>
      {!noScans && (
        <View style={{ flexDirection: "row", gap: 6 }} aria-hidden>
          {Array.from({ length: pips }, (_, i) => (
            <View
              key={i}
              style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < usedPips ? c.brand : c.track }}
            />
          ))}
        </View>
      )}
      {pro ? (
        <>
          {until && (
            <Text size={13} color={c.ink3}>
              {billing.data?.lifetime
                ? "Lifetime access."
                : billing.data?.willRenew
                  ? `Renews ${until}.`
                  : `Premium until ${until}; won't renew.`}
            </Text>
          )}
          <Button variant="secondary" onPress={() => Linking.openURL(manageSubscriptionUrl)}>
            Manage subscription
          </Button>
        </>
      ) : (
        <>
          <Text size={13} color={c.ink3}>
            {usage.paywall
              ? "Premium adds barcode and photo scanning, the AI Coach and unlimited reminders. Typing meals is always free."
              : "Typing meals and relogging usuals are always free."}
          </Text>
          {/* Paywall off: free users already have today's limits, so there is nothing to sell yet. */}
          {usage.paywall && (
            <Button icon={Crown} onPress={() => router.push("/pro")}>
              Try Premium free for 7 days
            </Button>
          )}
        </>
      )}
    </View>
  );
}

/** Design 13 "Export CSV": written to a cache file and handed to the share sheet. */
function ExportRow() {
  const c = useColors();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportCsv() {
    setBusy(true);
    setError(null);
    try {
      const csv = await apiText("/api/export");
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        Object.assign(document.createElement("a"), { href: url, download: "fitr8-export.csv" }).click();
        return;
      }
      const file = new File(Paths.cache, "fitr8-export.csv");
      if (file.exists) file.delete();
      file.create();
      file.write(csv);
      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        UTI: "public.comma-separated-values-text",
        dialogTitle: "Export FITR8 data",
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
        icon={<Download size={20} color={c.ink2} />}
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

const LEAVE_REASONS: { value: DeleteReason; label: string }[] = [
  { value: "logging_effort", label: "Logging takes too long" },
  { value: "inaccurate", label: "Numbers felt wrong" },
  { value: "price", label: "Too expensive" },
  { value: "goal_reached", label: "I reached my goal" },
  { value: "privacy", label: "Privacy worries" },
  { value: "other_app", label: "Using another app" },
  { value: "other", label: "Something else" },
];

/**
 * Delete account, deliberately slow: 1) what goes, a billing warning, an optional "why" (reasons and a
 * note, stored without the user) and "Sign out instead"; 2) type DELETE; 3) a last system alert.
 */
function DangerZone({ onDeleted, onSignOut }: { onDeleted: () => void; onSignOut: () => void }) {
  const c = useColors();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"why" | "confirm">("why");
  const [reasons, setReasons] = useState<DeleteReason[]>([]);
  const [feedback, setFeedback] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setStep("why");
    setTyped("");
    setError(null);
  };
  const toggle = (r: DeleteReason) => setReasons((all) => (all.includes(r) ? all.filter((x) => x !== r) : [...all, r]));

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/account", {
        method: "DELETE",
        json: { reasons, ...(feedback.trim() ? { feedback: feedback.trim() } : {}) },
      });
      queryClient.clear();
      onDeleted();
    } catch {
      setError("Couldn't delete your account. Try again.");
      setBusy(false);
    }
  }

  /** The last stop: a system alert, so it can't be a stray tap. */
  function confirmLast() {
    if (Platform.OS === "web") {
      if (globalThis.confirm?.("Delete your FITR8 account for good? This can't be undone.")) void remove();
      return;
    }
    Alert.alert("Delete for good?", "Your account and all your data go now. This can't be undone.", [
      { text: "Keep my account", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove() },
    ]);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        <Trash2 size={16} color={c.brandText} />
        <Text weight={600} color={c.brandText}>
          Delete account
        </Text>
      </Pressable>
      <Sheet open={open} onClose={close} title={step === "why" ? "Before you go" : "Delete your account?"}>
        {step === "why" ? (
          <>
            <Text color={c.ink2}>
              Deleting removes your meals, weigh-ins, workouts, streak, saved meals and plan for good. We can&apos;t
              bring them back. You can download a copy first from &ldquo;Your data&rdquo;.
            </Text>
            <Text size={13} color={c.cautionText}>
              Paying for FITR8 Premium through the App Store or Google Play? Cancel it there too: deleting your account
              doesn&apos;t stop the store billing you.
            </Text>
            <View style={{ gap: 8 }}>
              <Text weight={600}>Why are you leaving? (optional)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {LEAVE_REASONS.map((r) => (
                  <Chip key={r.value} selected={reasons.includes(r.value)} onPress={() => toggle(r.value)}>
                    {r.label}
                  </Chip>
                ))}
              </View>
              <TextInput
                accessibilityLabel="What could we do better? (optional)"
                value={feedback}
                onChangeText={setFeedback}
                placeholder="What could we do better? (optional)"
                placeholderTextColor={c.ink3}
                multiline
                maxLength={1000}
                style={[styles.confirm, { height: 96, paddingTop: 12, textAlignVertical: "top" }]}
              />
              <Text size={12} color={c.ink3}>
                Your answer is kept without your name or email, only to make FITR8 better.
              </Text>
            </View>
            <Button variant="secondary" onPress={() => setStep("confirm")}>
              Continue to delete
            </Button>
            <Button
              onPress={() => {
                close();
                onSignOut();
              }}
            >
              Just sign out instead
            </Button>
            <Button variant="secondary" onPress={close}>
              Keep my account
            </Button>
          </>
        ) : (
          <>
            <Text color={c.ink2}>Type DELETE to confirm. This deletes everything now, for good.</Text>
            <TextInput
              accessibilityLabel="Type DELETE to confirm"
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="DELETE"
              placeholderTextColor={c.ink3}
              style={styles.confirm}
            />
            {error && <FieldError>{error}</FieldError>}
            <Button
              variant="danger"
              onPress={confirmLast}
              loading={busy}
              disabled={typed.trim().toUpperCase() !== "DELETE"}
            >
              Delete my account
            </Button>
            <Button variant="secondary" onPress={close} disabled={busy}>
              Keep my account
            </Button>
          </>
        )}
      </Sheet>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.sunken },
  planPill: { borderRadius: 999, backgroundColor: c.chip, paddingHorizontal: 10, paddingVertical: 2 },
  goal: {
    gap: 12,
    borderRadius: radius.card,
    backgroundColor: c.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.panelLine,
    padding: 20,
  },
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
  group: { borderRadius: radius.card, backgroundColor: c.surface },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  planCard: { gap: 12, borderRadius: radius.card, backgroundColor: c.surface, padding: 16 },
  confirm: {
    height: 52,
    borderWidth: 1,
    borderColor: c.lineStrong,
    borderRadius: radius.input,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.sans600,
    fontSize: 18,
    letterSpacing: 2,
    color: c.ink,
  },
}));
