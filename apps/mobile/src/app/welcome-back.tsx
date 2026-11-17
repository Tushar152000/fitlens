import { useQuery } from "@tanstack/react-query";
import type { WelcomeBackDto, WelcomeBackInput } from "@fitr8/contracts";
import { router } from "expo-router";
import { CalendarClock, Check } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ACTIVITY_OPTIONS, EQUIPMENT_OPTIONS } from "@/components/profile-options";
import { FormSkeleton } from "@/components/skeletons";
import {
  Button,
  Card,
  ChipGroup,
  ChoiceCardGroup,
  FieldError,
  NumberField,
  Segmented,
  Text,
  TileGroup,
} from "@/components/ui";
import { track } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api";
import { useAuth, useMe } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";
import type { PlanResponse } from "@/lib/types-plan";

type Profile = NonNullable<ReturnType<typeof useMe>["profile"]>;

interface Draft {
  weightKg: string;
  heightCm: string;
  waistCm: string;
  neckCm: string;
  hipCm: string;
  activityLevel: Profile["activityLevel"];
  equipment: Profile["equipment"];
  trainingDaysPerWeek: number;
  sessionMinutes: number;
  injuries: string;
  medicalFlag: boolean;
}
type Errors = Partial<Record<keyof Draft, string>>;

const str = (n: number | null | undefined) => (n == null ? "" : String(n));
const num = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : undefined);

/** Same ranges as onboarding (contracts WelcomeBackSchema). */
function validate(d: Draft, bodyFatGoal: boolean): Errors {
  const e: Errors = {};
  const range = (key: keyof Draft, v: number | undefined, lo: number, hi: number, label: string, required: boolean) => {
    if (v === undefined) {
      if (required) e[key] = `Enter your ${label}`;
    } else if (!Number.isFinite(v) || v < lo || v > hi) e[key] = `Enter ${label} between ${lo} and ${hi}`;
  };
  range("weightKg", num(d.weightKg), 30, 250, "weight", true);
  range("heightCm", num(d.heightCm), 120, 230, "height", true);
  range("waistCm", num(d.waistCm), 40, 200, "waist", bodyFatGoal);
  range("neckCm", num(d.neckCm), 20, 70, "neck", bodyFatGoal);
  range("hipCm", num(d.hipCm), 50, 200, "hip", false);
  return e;
}

/**
 * Back after 90+ days away (MeDto.welcomeBack): ask again only what changes over time — weight,
 * height, how active, where and how much they train, injuries, the health flag. Sex, birth date,
 * diet and the goal are kept. Weight starts empty on purpose: the old one is the hint, not the answer.
 */
export default function WelcomeBackScreen() {
  const me = useMe();
  const plan = useQuery({ queryKey: ["plan"], queryFn: () => api<PlanResponse>("/api/plan") });
  const c = useColors();

  if (plan.isPending || !me.profile) {
    return (
      <View style={{ flex: 1, padding: 24, paddingTop: 72, gap: 20, backgroundColor: c.ground }}>
        <FormSkeleton />
      </View>
    );
  }
  // No plan to read (shouldn't happen once onboarded): the form still works without the hints.
  return <WelcomeBackForm profile={me.profile} name={me.name} plan={plan.data ?? null} />;
}

function WelcomeBackForm({
  profile,
  name,
  plan,
}: {
  profile: Profile;
  name: string | null;
  plan: PlanResponse | null;
}) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const styles = useStyles();
  const { refresh } = useAuth();
  const bodyFatGoal = plan?.goal.targetBodyFatPct != null;
  const lastWeight = plan?.metric.weightKg;

  const [draft, setDraft] = useState<Draft>({
    weightKg: "",
    heightCm: str(profile.heightCm),
    waistCm: "",
    neckCm: "",
    hipCm: "",
    activityLevel: profile.activityLevel,
    equipment: profile.equipment,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    sessionMinutes: profile.sessionMinutes,
    injuries: profile.injuries.join(", "),
    medicalFlag: profile.medicalFlag,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<"save" | "skip" | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [goalPassed, setGoalPassed] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function save() {
    const found = validate(draft, bodyFatGoal);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy("save");
    setServerError(null);
    const body: WelcomeBackInput = {
      weightKg: num(draft.weightKg)!,
      heightCm: num(draft.heightCm)!,
      waistCm: num(draft.waistCm),
      neckCm: num(draft.neckCm),
      hipCm: profile.sex === "FEMALE" ? num(draft.hipCm) : undefined,
      activityLevel: draft.activityLevel,
      equipment: draft.equipment,
      trainingDaysPerWeek: draft.trainingDaysPerWeek,
      sessionMinutes: draft.sessionMinutes,
      injuries: draft.injuries
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10),
      medicalFlag: draft.medicalFlag,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    };
    try {
      const res = await api<WelcomeBackDto>("/api/welcome-back", { json: body });
      track("welcome_back", { action: "updated" });
      // New weight and routine change targets, the workout plan and everything derived from them.
      void queryClient.invalidateQueries();
      if (res.goalPassed) {
        setGoalPassed(true);
        setBusy(null);
        return;
      }
      await refresh(); // welcomeBack is now false: the guard opens the app on Today.
    } catch (err) {
      const details = err instanceof ApiError ? (err.details as { message?: string }[] | undefined) : undefined;
      setServerError(
        details?.[0]?.message ?? (err instanceof Error ? err.message : "Something went wrong. Try again."),
      );
      setBusy(null);
    }
  }

  async function notNow() {
    setBusy("skip");
    setServerError(null);
    try {
      await api("/api/me/active", { method: "POST" });
      track("welcome_back", { action: "dismissed" });
      await refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(null);
    }
  }

  if (goalPassed) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 48, paddingBottom: Math.max(16, insets.bottom) }]}>
        <View style={{ flex: 1, paddingHorizontal: 24, gap: 16 }}>
          <View style={styles.badge}>
            <CalendarClock size={28} color={c.brandText} />
          </View>
          <Text variant="h1">Your goal date has passed</Text>
          <Text color={c.ink2}>
            Your targets now use today&apos;s numbers. The date you aimed for went by while you were away, so pick a new
            one to get a realistic pace again.
          </Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 10 }}>
          <Button
            onPress={() => {
              // Onboarding stays reachable for a signed-in user; refreshing then opens the app behind it.
              router.replace("/onboarding");
              void refresh();
            }}
          >
            Set a new goal
          </Button>
          <Button variant="secondary" onPress={() => void refresh()}>
            Keep my goal for now
          </Button>
        </View>
      </View>
    );
  }

  const first = name?.split(" ")[0];
  return (
    <View style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: 24, gap: 24 }}
      >
        <View style={{ gap: 8 }}>
          <Text variant="meta">It&apos;s been a while</Text>
          <Text variant="h1">Welcome back{first ? `, ${first}` : ""}</Text>
          <Text color={c.ink2}>
            A few months can change a lot. Check these so your calories and workouts fit you today. Your goal and
            everything else stay as they were.
          </Text>
        </View>

        <Card>
          <Text variant="h2">Your body now</Text>
          <View style={styles.grid}>
            <View style={styles.cell}>
              <NumberField
                label="Weight today"
                unit="kg"
                placeholder={lastWeight != null ? String(lastWeight) : "75"}
                value={draft.weightKg}
                onValueChange={(v) => set("weightKg", v)}
                error={errors.weightKg}
              />
            </View>
            <View style={styles.cell}>
              <NumberField
                label="Height"
                unit="cm"
                placeholder="170"
                value={draft.heightCm}
                onValueChange={(v) => set("heightCm", v)}
                error={errors.heightCm}
              />
            </View>
            {bodyFatGoal && (
              <>
                <View style={styles.cell}>
                  <NumberField
                    label="Waist"
                    unit="cm"
                    placeholder={str(plan?.metric.waistCm)}
                    value={draft.waistCm}
                    onValueChange={(v) => set("waistCm", v)}
                    error={errors.waistCm}
                  />
                </View>
                <View style={styles.cell}>
                  <NumberField
                    label="Neck"
                    unit="cm"
                    placeholder={str(plan?.metric.neckCm)}
                    value={draft.neckCm}
                    onValueChange={(v) => set("neckCm", v)}
                    error={errors.neckCm}
                  />
                </View>
                {profile.sex === "FEMALE" && (
                  <View style={styles.cell}>
                    <NumberField
                      label="Hip (optional)"
                      unit="cm"
                      placeholder={str(plan?.metric.hipCm)}
                      value={draft.hipCm}
                      onValueChange={(v) => set("hipCm", v)}
                      error={errors.hipCm}
                    />
                  </View>
                )}
              </>
            )}
          </View>
          {lastWeight != null && (
            <Text size={13} color={c.ink3}>
              Last time you weighed {lastWeight} kg. Weigh in the morning, before food.
            </Text>
          )}
        </Card>

        <View style={{ gap: 10 }}>
          <Text variant="label">How active are you outside workouts?</Text>
          <ChoiceCardGroup
            label="Activity level"
            value={draft.activityLevel}
            onChange={(v) => set("activityLevel", v)}
            options={ACTIVITY_OPTIONS}
          />
        </View>

        <View style={{ gap: 10 }}>
          <Text variant="label">Where I train</Text>
          <TileGroup
            label="Where I train"
            value={draft.equipment}
            onChange={(v) => set("equipment", v)}
            options={EQUIPMENT_OPTIONS}
          />
        </View>

        <View style={{ gap: 10 }}>
          <Text variant="label">Days per week</Text>
          <ChipGroup
            label="Days per week"
            value={draft.trainingDaysPerWeek}
            onChange={(v) => set("trainingDaysPerWeek", v)}
            options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} days` }))}
          />
        </View>

        <View style={{ gap: 10 }}>
          <Text variant="label">Minutes per session</Text>
          <Segmented
            label="Minutes per session"
            value={Math.min(60, Math.max(30, Math.round(draft.sessionMinutes / 15) * 15))}
            onChange={(v) => set("sessionMinutes", v)}
            options={[30, 45, 60].map((n) => ({ value: n, label: `${n} min` }))}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text variant="label">Injuries or pain (optional)</Text>
          <TextInput
            accessibilityLabel="Injuries or pain"
            value={draft.injuries}
            onChangeText={(v) => set("injuries", v)}
            placeholder="e.g. left knee, lower back"
            placeholderTextColor={`${c.ink3}99`}
            style={styles.textInput}
          />
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.medicalFlag }}
          onPress={() => set("medicalFlag", !draft.medicalFlag)}
          style={styles.check}
        >
          <View style={[styles.box, draft.medicalFlag && { backgroundColor: c.brand, borderColor: c.brand }]}>
            {draft.medicalFlag && <Check size={16} color={c.white} strokeWidth={3} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text weight={600}>I have a medical condition, am pregnant, or am under 18</Text>
            <Text size={13} color={c.ink3}>
              We&apos;ll keep calories at maintenance instead of a deficit. Check with your doctor.
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        {serverError && <FieldError>{serverError}</FieldError>}
        {Object.values(errors).some(Boolean) && (
          <Text size={13} color={c.ink2} center>
            Check the highlighted fields above.
          </Text>
        )}
        <Button onPress={save} loading={busy === "save"} disabled={busy === "skip"}>
          Update my plan
        </Button>
        <Button variant="secondary" onPress={notNow} loading={busy === "skip"} disabled={busy === "save"}>
          Not now
        </Button>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.ground },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: c.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "47%", flexGrow: 1 },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: c.ground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.line,
  },
  textInput: {
    height: 52,
    borderWidth: 1,
    borderColor: c.lineStrong,
    borderRadius: radius.input,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.sans400,
    fontSize: 16,
    color: c.ink,
  },
  check: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderRadius: radius.card,
    backgroundColor: c.surface,
    padding: 16,
  },
  box: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
}));
