import { useQuery } from "@tanstack/react-query";
import type { ReminderDraftDto, ReminderDto, ReminderRuleDto } from "@fitr8/contracts";
import { BellOff, BellRing, Minus, Plus, Sparkles, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AppState, Linking, Pressable, TextInput, View } from "react-native";
import { BackHeader } from "@/components/back-header";
import { QueryError } from "@/components/query-error";
import { Sheet } from "@/components/sheet";
import { ListSkeleton } from "@/components/skeletons";
import { Button, Card, Chip, FieldError, Screen, Switch, Text } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { track } from "@/lib/analytics";
import { confirmAction } from "@/lib/confirm";
import { queryClient } from "@/lib/query";
import { remindersQuery } from "@/lib/queries";
import { ensureNotificationPermission, localDate, notificationStatus } from "@/lib/reminders";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

/** The one shape the sheet edits directly: days of the week + time(s). */
type Weekly = NonNullable<ReminderRuleDto["weekly"]>;
type Status = Awaited<ReturnType<typeof notificationStatus>>;

/** What the sheet edits: a fresh draft from words (no id) or a saved reminder. */
interface Draft {
  /** New for every opening, so the form starts fresh even for the same words. */
  nonce: number;
  id?: string;
  title: string;
  description: string;
  rules: ReminderRuleDto[];
  prompt?: string;
}

const EXAMPLES = [
  "Take creatine every day at 9 am",
  "Drink water every 2 hours",
  "Stretch on weekdays at 6:30 pm",
  "Weigh in every Monday at 7 am",
  "Weigh in on the 1st and last day of the month",
];
// Monday first, as people in India read a week. Values are 0 = Sunday … 6 = Saturday.
const WEEK = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

/** Reminders you describe in words. The server keeps the list; this phone schedules the alerts. */
export default function RemindersScreen() {
  const c = useColors();
  const styles = useStyles();
  const list = useQuery(remindersQuery);
  const status = useNotificationStatus();
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const reminders = list.data?.reminders ?? [];
  const max = list.data?.max ?? 20;
  const full = reminders.length >= max;

  async function create() {
    const value = text.trim();
    setParseError(null);
    if (value.length < 3) return setParseError("Tell us what to remind you about, and when.");
    setParsing(true);
    try {
      const d = await api<ReminderDraftDto>("/api/reminders/parse", { json: { text: value } });
      setDraft({
        nonce: Date.now(),
        title: d.title,
        description: d.description ?? "",
        rules: d.rules,
        prompt: value,
      });
    } catch (e) {
      setParseError(e instanceof ApiError ? e.message : "Couldn't set that up. Try again.");
    } finally {
      setParsing(false);
    }
  }

  async function toggle(r: ReminderDto, enabled: boolean) {
    setListError(null);
    setToggling(r.id);
    if (enabled) await ensureNotificationPermission().catch(() => false);
    // Optimistic: the switch moves at once, the phone reschedules when the list refreshes.
    queryClient.setQueryData(remindersQuery.queryKey, (old: typeof list.data) =>
      old ? { ...old, reminders: old.reminders.map((x) => (x.id === r.id ? { ...x, enabled } : x)) } : old,
    );
    try {
      await api(`/api/reminders/${r.id}`, { method: "PATCH", json: { enabled } });
    } catch {
      setListError("Couldn't save that change. Try again.");
    } finally {
      setToggling(null);
      queryClient.invalidateQueries({ queryKey: remindersQuery.queryKey });
    }
  }

  return (
    <Screen
      refreshing={list.isRefetching}
      onRefresh={() => {
        list.refetch();
        status.refresh();
      }}
    >
      <BackHeader />
      <View style={{ gap: 6 }}>
        <Text variant="h1">Reminders</Text>
        <Text color={c.ink2}>Say what and when, in your own words. Your phone does the reminding.</Text>
      </View>

      <PermissionNote status={status.value} />

      <Card style={{ gap: 12 }}>
        <Text weight={600}>New reminder</Text>
        <TextInput
          accessibilityLabel="Describe your reminder"
          value={text}
          onChangeText={(v) => {
            setText(v);
            setParseError(null);
          }}
          multiline
          maxLength={300}
          editable={!full}
          placeholder="e.g. Remind me to take creatine every day at 9 am"
          placeholderTextColor={c.ink3}
          style={styles.textarea}
          textAlignVertical="top"
        />
        {!text.trim() && !full && (
          <View style={styles.examples} accessibilityLabel="Examples">
            {EXAMPLES.map((e) => (
              <Chip key={e} onPress={() => setText(e)}>
                {e}
              </Chip>
            ))}
          </View>
        )}
        {parseError && <FieldError>{parseError}</FieldError>}
        {full ? (
          <Text size={13} color={c.ink3}>
            You have {max} reminders, the most you can keep. Delete one to add another.
          </Text>
        ) : (
          <Button icon={Sparkles} onPress={create} loading={parsing} disabled={!text.trim()}>
            Set up reminder
          </Button>
        )}
      </Card>

      <View style={{ gap: 8 }}>
        <View style={styles.sectionHead}>
          <Text variant="h2">Your reminders</Text>
          {reminders.length > 0 && (
            <Text size={13} color={c.ink3} tabular>
              {reminders.length} of {max}
            </Text>
          )}
        </View>
        {list.isPending ? (
          <ListSkeleton rows={3} />
        ) : list.isError ? (
          <QueryError error={list.error} onRetry={() => list.refetch()} />
        ) : reminders.length === 0 ? (
          <Card style={{ alignItems: "center", gap: 8, paddingVertical: 24 }}>
            <BellRing size={28} color={c.ink3} />
            <Text weight={600} center>
              No reminders yet
            </Text>
            <Text size={13} color={c.ink3} center>
              Creatine, water, a walk after dinner, Monday weigh-ins — describe one above.
            </Text>
          </Card>
        ) : (
          reminders.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              busy={toggling === r.id}
              onToggle={(v) => toggle(r, v)}
              onOpen={() =>
                setDraft({
                  nonce: Date.now(),
                  id: r.id,
                  title: r.title,
                  description: r.description ?? "",
                  rules: r.rules,
                })
              }
            />
          ))
        )}
        {listError && <FieldError>{listError}</FieldError>}
      </View>

      <ReminderSheet
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={() => {
          setDraft(null);
          setText("");
          status.refresh();
        }}
      />
    </Screen>
  );
}

function ReminderCard({
  reminder: r,
  busy,
  onToggle,
  onOpen,
}: {
  reminder: ReminderDto;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  onOpen: () => void;
}) {
  const c = useColors();
  const styles = useStyles();
  const next = r.enabled && r.nextAt ? localDate(r.nextAt) : null;
  return (
    <View style={[styles.card, !r.enabled && { opacity: 0.7 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${r.title}, ${r.summary}. Edit`}
        onPress={onOpen}
        style={{ flex: 1, gap: 2, minHeight: 44 }}
      >
        <Text weight={600} numberOfLines={1}>
          {r.title}
        </Text>
        {r.description ? (
          <Text size={13} color={c.ink2} numberOfLines={2}>
            {r.description}
          </Text>
        ) : null}
        <Text size={13} color={c.ink3}>
          {r.summary}
        </Text>
        {next && (
          <Text weight={600} size={13} color={c.brandText}>
            Next: {formatNext(next)}
          </Text>
        )}
      </Pressable>
      <Switch checked={r.enabled} onChange={(v) => !busy && onToggle(v)} label={`${r.title} on`} />
    </View>
  );
}

/** Review a draft from words, or edit a saved reminder: title, line, days and time. */
function ReminderSheet({ draft, onClose, onSaved }: { draft: Draft | null; onClose: () => void; onSaved: () => void }) {
  // Keep the last draft while the sheet slides away, so it doesn't empty mid-animation.
  const [shown, setShown] = useState(draft);
  if (draft && draft !== shown) setShown(draft);
  return (
    <Sheet open={draft !== null} onClose={onClose} title={shown?.id ? "Edit reminder" : "Check your reminder"}>
      {shown && <ReminderForm key={shown.nonce} draft={shown} onSaved={onSaved} />}
    </Sheet>
  );
}

function ReminderForm({ draft, onSaved }: { draft: Draft; onSaved: () => void }) {
  const c = useColors();
  const styles = useStyles();
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  // One days-of-the-week rule is edited with the day toggles and time stepper; anything richer
  // (monthly dates, the last day, several rules) is shown as written and changed by describing it again.
  const initialWeekly = draft.rules.length === 1 ? draft.rules[0]!.weekly : null;
  const [schedule, setSchedule] = useState<Weekly | null>(initialWeekly);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(draft.id);

  const single = schedule?.hours.length === 1;

  function toggleDay(day: number) {
    setError(null);
    setSchedule((s) => {
      if (!s) return s;
      const has = s.weekdays.includes(day);
      const weekdays = has ? s.weekdays.filter((d) => d !== day) : [...s.weekdays, day].sort((a, b) => a - b);
      return { ...s, weekdays };
    });
  }

  /** ±15 minutes, wrapping round midnight. Only for a once-a-day time. */
  function shift(minutes: number) {
    setSchedule((s) => {
      if (!s) return s;
      const total = (((s.hours[0]! * 60 + s.minute + minutes) % 1440) + 1440) % 1440;
      return { ...s, hours: [Math.floor(total / 60)], minute: total % 60 };
    });
  }

  async function save() {
    if (!title.trim()) return setError("Give it a title.");
    if (schedule && !schedule.weekdays.length) return setError("Pick at least one day.");
    setBusy(true);
    setError(null);
    try {
      // Ask the first time a reminder is saved: that's when the reason is obvious.
      await ensureNotificationPermission().catch(() => false);
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        crons: schedule ? [toCron(schedule)] : draft.rules.map((r) => r.cron),
      };
      if (draft.id) {
        await api(`/api/reminders/${draft.id}`, { method: "PATCH", json: body });
      } else {
        await api("/api/reminders", { json: { ...body, prompt: draft.prompt ?? null } });
        const changed = schedule !== null && initialWeekly !== null && toCron(schedule) !== toCron(initialWeekly);
        track("reminder_created", { from: changed ? "edited" : "words" });
      }
      await queryClient.invalidateQueries({ queryKey: remindersQuery.queryKey });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft.id) return;
    if (!(await confirmAction(`Delete "${draft.title}"?`, "You won't get this reminder any more.", "Delete"))) return;
    try {
      await api(`/api/reminders/${draft.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: remindersQuery.queryKey });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete. Try again.");
    }
  }

  return (
    <>
      <View style={styles.summary} accessibilityLiveRegion="polite">
        <BellRing size={18} color={c.brandText} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 4 }}>
          {schedule ? (
            <Text weight={600} color={c.brandText}>
              {describe(schedule)}
            </Text>
          ) : (
            draft.rules.map((r) => (
              <Text key={r.cron} weight={600} color={c.brandText}>
                {draft.rules.length > 1 ? `• ${r.summary}` : r.summary}
              </Text>
            ))
          )}
        </View>
      </View>

      <Field label="Title">
        <TextInput
          accessibilityLabel="Title"
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            setError(null);
          }}
          maxLength={60}
          style={styles.input}
        />
      </Field>
      <Field label="Note (optional)">
        <TextInput
          accessibilityLabel="Note"
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          placeholder="Shown under the title"
          placeholderTextColor={c.ink3}
          style={styles.input}
        />
      </Field>

      {schedule ? (
        <>
          <Field label="Days">
            <View style={styles.days} accessibilityLabel="Days">
              {WEEK.map(([day, label]) => (
                <Pressable
                  key={day}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: schedule.weekdays.includes(day) }}
                  accessibilityLabel={label}
                  onPress={() => toggleDay(day)}
                  style={[styles.day, schedule.weekdays.includes(day) && styles.dayOn]}
                >
                  <Text weight={600} size={13} color={schedule.weekdays.includes(day) ? c.onStrong : c.ink2}>
                    {label.slice(0, 2)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label={single ? "Time" : "Times"}>
            {single ? (
              <View style={styles.time}>
                <RoundButton icon={Minus} label="15 minutes earlier" onPress={() => shift(-15)} />
                <Text variant="h1" size={26} tabular style={{ flex: 1, textAlign: "center" }}>
                  {clock(schedule.hours[0]!, schedule.minute)}
                </Text>
                <RoundButton icon={Plus} label="15 minutes later" onPress={() => shift(15)} />
              </View>
            ) : (
              <View style={{ gap: 4 }}>
                <Text weight={600} tabular>
                  {schedule.hours.map((h) => clock(h, schedule.minute)).join(" · ")}
                </Text>
                <Text size={13} color={c.ink3}>
                  To change these times, describe the reminder again.
                </Text>
              </View>
            )}
          </Field>
        </>
      ) : (
        <Text size={13} color={c.ink3}>
          {draft.rules.some((r) => !r.repeating)
            ? "Dates that move (like the second-last day) are planned a few ahead and topped up each time you open FITR8. "
            : ""}
          To change the days or times, describe the reminder again.
        </Text>
      )}

      {error && <FieldError>{error}</FieldError>}
      <Button onPress={save} loading={busy}>
        {editing ? "Save changes" : "Set reminder"}
      </Button>
      {editing && (
        <Button variant="secondary" icon={Trash2} onPress={remove}>
          Delete reminder
        </Button>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ gap: 8 }}>
      <Text weight={600} size={13} color={c.ink2}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function RoundButton({ icon: Icon, label, onPress }: { icon: typeof Plus; label: string; onPress: () => void }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.round} hitSlop={4}>
      <Icon size={20} color={c.ink} />
    </Pressable>
  );
}

/** Explains why nothing will ring, with the way to fix it. Hidden when notifications work. */
function PermissionNote({ status }: { status: Status | null }) {
  const c = useColors();
  const styles = useStyles();
  if (status === null || status === "granted" || status === "undetermined") return null;
  const unavailable = status === "unavailable";
  return (
    <View style={styles.note}>
      <BellOff size={20} color={c.cautionText} />
      <View style={{ flex: 1, gap: 8 }}>
        <Text size={14} color={c.cautionText}>
          {unavailable
            ? "Reminders ring in the installed FITR8 app. You can still set them up here."
            : "Notifications are off for FITR8, so reminders can't ring. Turn them on in Settings."}
        </Text>
        {!unavailable && (
          <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()} hitSlop={6}>
            <Text weight={600} size={14} color={c.cautionText} style={{ textDecorationLine: "underline" }}>
              Open Settings
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Notification permission, re-read when the app comes back (e.g. from Settings). */
function useNotificationStatus() {
  const [value, setValue] = useState<Status | null>(null);
  const refresh = useCallback(() => {
    notificationStatus()
      .then(setValue)
      .catch(() => setValue("unavailable"));
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);
  return { value, refresh };
}

// ── Schedule helpers (the API has the final say: it validates and re-describes the cron) ──

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function clock(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

function toCron(s: Weekly): string {
  const days = s.weekdays.length === 7 ? "*" : s.weekdays.join(",");
  return `${s.minute} ${s.hours.join(",")} * * ${days}`;
}

/** Same wording as the API's summary, for live feedback while editing. */
function describe(s: Weekly): string {
  const w = s.weekdays;
  const days =
    w.length === 7
      ? "Every day"
      : w.join() === "1,2,3,4,5"
        ? "Weekdays"
        : w.join() === "0,6"
          ? "Weekends"
          : w.length === 0
            ? "No days picked"
            : w.length === 1
              ? `Every ${DAY_SHORT[w[0]!]}`
              : [...w]
                  .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
                  .map((d) => DAY_SHORT[d])
                  .join(", ");
  const { hours, minute } = s;
  const times = hours.map((h) => clock(h, minute));
  if (times.length === 1) return `${days} at ${times[0]}`;
  const step = hours[1]! - hours[0]!;
  if (hours.length >= 3 && hours.every((h, i) => i === 0 || h - hours[i - 1]! === step)) {
    return `${days}, ${step === 1 ? "every hour" : `every ${step} hours`} from ${times[0]} to ${times.at(-1)}`;
  }
  return `${days} at ${times.slice(0, -1).join(", ")} and ${times.at(-1)}`;
}

function formatNext(d: Date): string {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const time = clock(d.getHours(), d.getMinutes());
  if (d.toDateString() === now.toDateString()) return `today, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow, ${time}`;
  const inAWeek = d.getTime() - now.getTime() < 6 * 86_400_000;
  const day = new Intl.DateTimeFormat(
    "en-IN",
    inAWeek ? { weekday: "long" } : { weekday: "short", day: "numeric", month: "short" },
  ).format(d);
  return `${day}, ${time}`;
}

const useStyles = makeStyles((c) => ({
  textarea: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: c.lineStrong,
    borderRadius: radius.input,
    backgroundColor: c.surface,
    padding: 14,
    fontFamily: fonts.sans400,
    fontSize: 16,
    lineHeight: 22,
    color: c.ink,
  },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.card,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summary: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: radius.input,
    backgroundColor: c.sunken,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: c.lineStrong,
    borderRadius: radius.input,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.sans600,
    fontSize: 16,
    color: c.ink,
  },
  days: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  day: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: c.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  dayOn: { backgroundColor: c.strong },
  time: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.input,
    backgroundColor: c.surface,
    padding: 6,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.sunken,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    flexDirection: "row",
    gap: 10,
    borderRadius: radius.card,
    backgroundColor: c.cautionSoft,
    padding: 14,
  },
}));
