import { useQuery } from "@tanstack/react-query";
import { FormSkeleton } from "@/components/skeletons";
import { router } from "expo-router";
import {
  Armchair,
  Bike,
  CalendarDays,
  Check,
  Dumbbell,
  Footprints,
  House,
  Info,
  Medal,
  Scale,
  Sparkles,
  Trophy,
} from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackHeader } from "@/components/back-header";
import { PlanBuilder } from "@/components/plan-builder";
import {
  Button,
  ChipGroup,
  ChoiceCardGroup,
  DateField,
  FieldError,
  NumberField,
  ProgressSteps,
  Segmented,
  Text,
  TileGroup,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query";
import { useMe } from "@/lib/auth";
import {
  emptyDraft,
  needsTarget,
  toPayload,
  validateStep,
  wantsBodyFat,
  ymd,
  type DraftErrors,
  type OnboardingDraft,
} from "@/lib/onboarding-draft";
import { colors, fonts, radius } from "@/lib/theme";
import type { PlanResponse } from "@/lib/types-plan";

const STEP_TITLES = ["Your goal", "About you", "Food and training"];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

/** Screens 2–4: three-step onboarding. Prefills from the existing profile when the goal is edited. */
export default function OnboardingScreen() {
  const me = useMe();
  const returning = me.onboarded;
  const plan = useQuery({
    queryKey: ["plan"],
    queryFn: () => api<PlanResponse>("/api/plan"),
    enabled: returning,
  });
  if (returning && plan.isPending) {
    return (
      <View style={{ flex: 1, padding: 24, paddingTop: 72, gap: 20, backgroundColor: colors.ground }}>
        <FormSkeleton />
      </View>
    );
  }

  const p = me.profile;
  const initial: Partial<OnboardingDraft> =
    returning && p
      ? {
          goalType: plan.data?.goal.type,
          targetMode: plan.data?.goal.targetBodyFatPct != null ? "BODY_FAT" : "WEIGHT",
          targetWeightKg: str(plan.data?.goal.targetWeightKg),
          targetBodyFatPct: str(plan.data?.goal.targetBodyFatPct),
          targetDate: plan.data?.goal.targetDate,
          sex: p.sex,
          birthDate: p.birthDate.slice(0, 10),
          heightCm: str(p.heightCm),
          weightKg: str(plan.data?.metric.weightKg),
          waistCm: str(plan.data?.metric.waistCm),
          neckCm: str(plan.data?.metric.neckCm),
          hipCm: str(plan.data?.metric.hipCm),
          activityLevel: p.activityLevel,
          dietType: p.dietType,
          experience: p.experience,
          equipment: p.equipment,
          trainingDaysPerWeek: p.trainingDaysPerWeek,
          sessionMinutes: p.sessionMinutes,
          injuries: p.injuries.join(", "),
          medicalFlag: p.medicalFlag,
        }
      : {};
  return <OnboardingForm initial={initial} returning={returning} />;
}

function OnboardingForm({ initial, returning }: { initial: Partial<OnboardingDraft>; returning: boolean }) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({ ...emptyDraft(), ...initial }));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [built, setBuilt] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const back = () => {
    setErrors({});
    if (step > 1) setStep(step - 1);
    else router.back();
  };

  async function next() {
    const found = validateStep(step, draft);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    if (step < 3) {
      setStep(step + 1);
      scroll.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      // Keep the "building your plan" moment on screen long enough to read (min 2.6 s).
      await Promise.all([api("/api/onboarding", { json: toPayload(draft, timezone) }), wait(2600)]);
      // A new goal changes targets, the workout plan and everything derived from them.
      void queryClient.invalidateQueries();
      setBuilt(true);
      await wait(700);
      router.replace("/onboarding/plan");
    } catch (err) {
      const details = err instanceof ApiError ? (err.details as { message?: string }[] | undefined) : undefined;
      setServerError(
        details?.[0]?.message ?? (err instanceof Error ? err.message : "Something went wrong. Try again."),
      );
      setSubmitting(false);
    }
  }

  const props = { draft, set, errors };
  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 24, paddingBottom: 24, gap: 24 }}
      >
        {step > 1 || returning ? (
          <BackHeader onBack={back}>
            <ProgressSteps current={step} total={4} />
          </BackHeader>
        ) : (
          <View style={{ minHeight: 44, justifyContent: "center" }}>
            <ProgressSteps current={step} total={4} />
          </View>
        )}
        <Text variant="h1">{STEP_TITLES[step - 1]}</Text>
        {step === 1 && <GoalStep {...props} />}
        {step === 2 && <AboutStep {...props} />}
        {step === 3 && <TrainingStep {...props} />}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        {serverError && <FieldError>{serverError}</FieldError>}
        {Object.keys(errors).some((k) => errors[k as keyof DraftErrors]) && (
          <Text size={13} color={colors.ink2} center>
            Check the highlighted fields above.
          </Text>
        )}
        <Button onPress={next} loading={submitting}>
          {step < 3 ? "Continue" : "Build my plan"}
        </Button>
      </View>
      {submitting && <PlanBuilder done={built} />}
    </View>
  );
}

type StepProps = {
  draft: OnboardingDraft;
  set: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  errors: DraftErrors;
};

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text variant="label">{label}</Text>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </View>
  );
}

function icon(I: typeof Scale) {
  return function ChoiceIcon(color: string) {
    return <I size={20} color={color} />;
  };
}

function GoalStep({ draft, set, errors }: StepProps) {
  return (
    <>
      <Field label="Pick one" error={errors.goalType}>
        <ChoiceCardGroup
          label="Goal"
          value={draft.goalType}
          onChange={(v) => set("goalType", v)}
          options={[
            { value: "FAT_LOSS", label: "Lose fat", description: "Drop fat, keep your muscle", icon: icon(Scale) },
            {
              value: "MUSCLE_GAIN",
              label: "Build muscle",
              description: "A lean surplus with progressive training",
              icon: icon(Dumbbell),
            },
            {
              value: "RECOMPOSITION",
              label: "Recomposition",
              description: "Stay near your weight, lose fat, gain muscle",
              icon: icon(Sparkles),
            },
          ]}
        />
      </Field>

      {needsTarget(draft) && (
        <View style={{ gap: 12 }}>
          <Text variant="label">Aim for</Text>
          <Segmented
            label="Aim for"
            value={draft.targetMode}
            onChange={(v) => set("targetMode", v)}
            options={[
              { value: "BODY_FAT", label: "Body fat %" },
              { value: "WEIGHT", label: "Weight" },
            ]}
          />
          {draft.targetMode === "WEIGHT" ? (
            <NumberField
              label="Target weight"
              unit="kg"
              placeholder="72"
              value={draft.targetWeightKg}
              onValueChange={(v) => set("targetWeightKg", v)}
              error={errors.targetWeightKg}
            />
          ) : (
            <NumberField
              label="Target body fat"
              unit="%"
              placeholder="15"
              value={draft.targetBodyFatPct}
              onValueChange={(v) => set("targetBodyFatPct", v)}
              error={errors.targetBodyFatPct}
              hint="We'll ask for waist and neck so we can estimate your current body fat."
            />
          )}
        </View>
      )}

      <ByWhen draft={draft} set={set} error={errors.targetDate} />
    </>
  );
}

const WEEK_OPTIONS = [12, 16, 24];

/** Design 2: "By when?" — three quick tiles with end dates, or an exact date. */
function ByWhen({ draft, set, error }: { draft: OnboardingDraft; set: StepProps["set"]; error?: string }) {
  const today = new Date();
  const dateIn = (weeks: number) => ymd(new Date(today.getTime() + weeks * 7 * 86_400_000));
  const short = (d: string) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d));
  const tileWeeks = WEEK_OPTIONS.find((w) => dateIn(w) === draft.targetDate);
  const [exact, setExact] = useState(tileWeeks === undefined);

  return (
    <Field label="By when?" error={exact ? undefined : error}>
      <TileGroup
        label="By when?"
        value={exact ? undefined : tileWeeks}
        onChange={(w) => {
          setExact(false);
          set("targetDate", dateIn(w));
        }}
        options={WEEK_OPTIONS.map((w) => ({ value: w, label: `${w} weeks`, sub: short(dateIn(w)) }))}
      />
      {exact ? (
        <DateField
          label="Exact date"
          value={draft.targetDate}
          onValueChange={(v) => set("targetDate", v)}
          error={error}
          hint="We'll tell you if it's too fast and suggest a safer date."
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExact(true)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start" }}
        >
          <CalendarDays size={20} color={colors.brand} />
          <Text weight={600} color={colors.brand}>
            Choose an exact date
          </Text>
        </Pressable>
      )}
    </Field>
  );
}

function AboutStep({ draft, set, errors }: StepProps) {
  const optional = wantsBodyFat(draft) ? "" : " (optional)";
  return (
    <>
      <Field label="Sex" error={errors.sex}>
        <Segmented
          label="Sex"
          value={draft.sex}
          onChange={(v) => set("sex", v)}
          options={[
            { value: "MALE", label: "Male" },
            { value: "FEMALE", label: "Female" },
          ]}
        />
      </Field>

      <DateField
        label="Date of birth"
        value={draft.birthDate}
        onValueChange={(v) => set("birthDate", v)}
        error={errors.birthDate}
      />

      <View style={styles.grid}>
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
        <View style={styles.cell}>
          <NumberField
            label="Weight"
            unit="kg"
            placeholder="75"
            value={draft.weightKg}
            onValueChange={(v) => set("weightKg", v)}
            error={errors.weightKg}
          />
        </View>
        <View style={styles.cell}>
          <NumberField
            label={`Waist${optional}`}
            unit="cm"
            value={draft.waistCm}
            onValueChange={(v) => set("waistCm", v)}
            error={errors.waistCm}
          />
        </View>
        <View style={styles.cell}>
          <NumberField
            label={`Neck${optional}`}
            unit="cm"
            value={draft.neckCm}
            onValueChange={(v) => set("neckCm", v)}
            error={errors.neckCm}
          />
        </View>
        {draft.sex === "FEMALE" && (
          <View style={styles.cell}>
            <NumberField
              label={`Hip${optional}`}
              unit="cm"
              value={draft.hipCm}
              onValueChange={(v) => set("hipCm", v)}
              error={errors.hipCm}
            />
          </View>
        )}
      </View>

      <View style={styles.tip}>
        <Info size={20} color={colors.ink2} style={{ marginTop: 2 }} />
        <Text size={13} color={colors.ink2} style={{ flex: 1 }}>
          <Text size={13} weight={600}>
            Measuring tip:
          </Text>{" "}
          use a soft tape, standing relaxed. Waist at the navel after breathing out; neck just below the Adam&apos;s
          apple{draft.sex === "FEMALE" ? "; hips at the widest point" : ""}. We use these to estimate body fat.
        </Text>
      </View>

      <Field label="How active are you outside workouts?" error={errors.activityLevel}>
        <ChoiceCardGroup
          label="Activity level"
          value={draft.activityLevel}
          onChange={(v) => set("activityLevel", v)}
          options={[
            {
              value: "SEDENTARY",
              label: "Mostly sitting",
              description: "Desk job, under 5k steps",
              icon: icon(Armchair),
            },
            {
              value: "LIGHT",
              label: "Lightly active",
              description: "5–8k steps, some walking",
              icon: icon(Footprints),
            },
            {
              value: "MODERATE",
              label: "Moderately active",
              description: "8–12k steps or an active job",
              icon: icon(Bike),
            },
            {
              value: "VERY_ACTIVE",
              label: "Very active",
              description: "On your feet all day or hard training",
              icon: icon(Medal),
            },
            {
              value: "ATHLETE",
              label: "Athlete",
              description: "Twice-a-day training or heavy labour",
              icon: icon(Trophy),
            },
          ]}
        />
      </Field>
    </>
  );
}

function TrainingStep({ draft, set, errors }: StepProps) {
  return (
    <>
      <Field label="Diet" error={errors.dietType}>
        <ChipGroup
          label="Diet"
          value={draft.dietType}
          onChange={(v) => set("dietType", v)}
          options={[
            { value: "VEG", label: "Veg" },
            { value: "NON_VEG", label: "Non-veg" },
            { value: "EGGETARIAN", label: "Eggetarian" },
            { value: "VEGAN", label: "Vegan" },
          ]}
        />
      </Field>

      <Field label="Where I train" error={errors.equipment}>
        <TileGroup
          label="Where I train"
          value={draft.equipment}
          onChange={(v) => set("equipment", v)}
          options={[
            { value: "FULL_GYM", label: "Gym", sub: "Machines, barbells", icon: icon(Dumbbell) },
            { value: "DUMBBELLS", label: "Home", sub: "A few dumbbells", icon: icon(House) },
            { value: "BODYWEIGHT", label: "Anywhere", sub: "No equipment", icon: icon(Footprints) },
          ]}
        />
      </Field>

      <Field label="Days per week">
        <ChipGroup
          label="Days per week"
          value={draft.trainingDaysPerWeek}
          onChange={(v) => set("trainingDaysPerWeek", v)}
          options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} days` }))}
        />
      </Field>

      <Field label="Minutes per session">
        <Segmented
          label="Minutes per session"
          value={Math.min(60, Math.max(30, Math.round(draft.sessionMinutes / 15) * 15))}
          onChange={(v) => set("sessionMinutes", v)}
          options={[30, 45, 60].map((n) => ({ value: n, label: `${n} min` }))}
        />
      </Field>

      <View style={{ gap: 6 }}>
        <Text variant="label">Injuries or pain (optional)</Text>
        <TextInput
          accessibilityLabel="Injuries or pain"
          value={draft.injuries}
          onChangeText={(v) => set("injuries", v)}
          placeholder="e.g. left knee, lower back"
          placeholderTextColor="rgba(107,110,118,0.6)"
          style={styles.textInput}
        />
        <Text size={13} color={colors.ink3}>
          We&apos;ll avoid exercises that load these.
        </Text>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: draft.medicalFlag }}
        onPress={() => set("medicalFlag", !draft.medicalFlag)}
        style={styles.check}
      >
        <View style={[styles.box, draft.medicalFlag && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
          {draft.medicalFlag && <Check size={16} color={colors.white} strokeWidth={3} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={600}>I have a medical condition, am pregnant, or am under 18</Text>
          <Text size={13} color={colors.ink3}>
            We&apos;ll keep calories at maintenance instead of a deficit. Check with your doctor.
          </Text>
        </View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingTop: 12,
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: colors.ground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "47%", flexGrow: 1 },
  tip: { flexDirection: "row", gap: 12, borderRadius: radius.card, backgroundColor: colors.sunken, padding: 16 },
  textInput: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.sans400,
    fontSize: 16,
    color: colors.ink,
  },
  check: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    padding: 16,
  },
  box: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
});
