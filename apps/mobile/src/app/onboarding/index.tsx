import { useQuery } from "@tanstack/react-query";
import { FormSkeleton } from "@/components/skeletons";
import { router } from "expo-router";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Dumbbell,
  Info,
  PersonStanding,
  Scale,
  Sparkles,
  Utensils,
} from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackHeader } from "@/components/back-header";
import { PlanBuilder } from "@/components/plan-builder";
import { ACTIVITY_OPTIONS, choiceIcon, EQUIPMENT_OPTIONS } from "@/components/profile-options";
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
import { track } from "@/lib/analytics";
import { queryClient } from "@/lib/query";
import { useMe } from "@/lib/auth";
import {
  emptyDraft,
  MEDICAL_NOTE_MAX,
  needsTarget,
  toPayload,
  validateStep,
  wantsBodyFat,
  ymd,
  type DraftErrors,
  type OnboardingDraft,
} from "@/lib/onboarding-draft";
import {
  flagEmoji,
  PHONE_TAKEN,
  personProblems,
  PHONE_COUNTRIES,
  phoneToE164,
  splitName,
  splitPhone,
  type PersonDetails,
  type PersonProblems,
} from "@/lib/person";
import { Sheet } from "@/components/sheet";
import { bodySummary, trainingSummary } from "@/lib/onboarding-summary";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";
import type { PlanResponse } from "@/lib/types-plan";
import type { PhoneCheckDto } from "@fitr8/contracts";

/** Step 0, "Your details", is shown to first-time users only (editing a goal starts at 1). */
/** Step 2 "About you" holds body stats plus food and training (draft steps 2 and 3). */
const STEP_TITLES = ["What can we call you?", "Your goal", "About you"];
const LAST_STEP = 2;
/** The line under each title (the web shows the same words). */
const STEP_LEADS = [
  "A few quick questions and you’ll have daily calories, macros and a training week built for you.",
  "Pick what you want and by when. We’ll check the pace is safe and set your daily calories.",
  "Your body, food and training decide your calories, macros and training week. Only you can see them.",
];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

/**
 * Onboarding: your details (first time only), then the three plan steps. Prefills from the account
 * and, when the goal is edited, from the existing profile.
 */
export default function OnboardingScreen() {
  const me = useMe();
  const returning = me.onboarded;
  const plan = useQuery({
    queryKey: ["plan"],
    queryFn: () => api<PlanResponse>("/api/plan"),
    enabled: returning,
  });
  const c = useColors();
  if (returning && plan.isPending) {
    return (
      <View style={{ flex: 1, padding: 24, paddingTop: 72, gap: 20, backgroundColor: c.ground }}>
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
          medicalNote: p.medicalNote ?? "",
        }
      : {};
  // The dev sign-in names accounts after the email, which isn't worth prefilling.
  const realName = me.name && me.name !== me.email?.split("@")[0] ? me.name : null;
  const phone = splitPhone(me.phone);
  const initialPerson: PersonDetails = {
    ...splitName(realName, me.lastName),
    phoneCountry: phone.country,
    phone: phone.national,
  };
  return <OnboardingForm initial={initial} initialPerson={initialPerson} returning={returning} />;
}

function OnboardingForm({
  initial,
  initialPerson,
  returning,
}: {
  initial: Partial<OnboardingDraft>;
  initialPerson: PersonDetails;
  returning: boolean;
}) {
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const firstStep = returning ? 1 : 0;
  const [step, setStep] = useState(firstStep);
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({ ...emptyDraft(), ...initial }));
  const [person, setPersonState] = useState<PersonDetails>(initialPerson);
  const [errors, setErrors] = useState<DraftErrors & PersonProblems>({});
  const [submitting, setSubmitting] = useState(false);
  const [built, setBuilt] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const setPerson = (key: keyof PersonDetails, value: string) => {
    setPersonState((p) => ({ ...p, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const back = () => {
    setErrors({});
    if (step > firstStep) setStep(step - 1);
    // Opened by replace (welcome back → "Set a new goal") there's nothing behind it.
    else if (router.canGoBack()) router.back();
    else router.replace("/today");
  };

  // "About you" folds into two parts; "Your body" starts open.
  const [openPart, setOpenPartNow] = useState({ body: true, food: false });
  /** Folding animates: the next layout change eases instead of jumping. */
  const setOpenPart: typeof setOpenPartNow = (next) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(260, "easeInEaseOut", "opacity"));
    setOpenPartNow(next);
  };
  const bodyDone = Object.keys(validateStep(2, draft)).length === 0;
  const foodDone = Object.keys(validateStep(3, draft)).length === 0;
  const partHasError = (n: 2 | 3) => Object.keys(validateStep(n, draft)).some((k) => errors[k as keyof typeof errors]);

  /** "Next: Food and training": check the body part, then fold it and open the next. */
  function finishBody() {
    const found = validateStep(2, draft);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setOpenPart({ body: false, food: true });
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  /** Continue / Build my plan unlock once this step's required answers are valid. */
  /** What still blocks this step, in field order (body before food on "About you"). */
  const problems: DraftErrors & PersonProblems =
    step === 0
      ? personProblems(person)
      : step === 1
        ? validateStep(1, draft)
        : { ...validateStep(2, draft), ...validateStep(3, draft) };
  const stepValid = Object.keys(problems).length === 0;
  // Names the first thing to fix, so a filled-in but rejected field never looks stuck.
  const firstProblem = Object.entries(problems).find(([, message]) => message);
  const continueHint = firstProblem ? hintFor(firstProblem[0], firstProblem[1]) : null;

  async function next() {
    const found: DraftErrors & PersonProblems =
      step === 0
        ? personProblems(person)
        : step === 1
          ? validateStep(1, draft)
          : { ...validateStep(2, draft), ...validateStep(3, draft) };
    if (Object.keys(found).length) {
      setErrors(found);
      // Open whichever part of "About you" holds the problem so it can be seen.
      if (step === 2) setOpenPart((o) => ({ body: o.body || !bodyDone, food: o.food || !foodDone }));
      return;
    }
    // Warn now if another account has the number; the save refuses it anyway (409).
    if (step === 0 && person.phone.trim()) {
      const phone = phoneToE164(person.phoneCountry, person.phone);
      setSubmitting(true);
      const check = phone
        ? await api<PhoneCheckDto>(`/api/profile/phone-check?phone=${encodeURIComponent(phone)}`).catch(() => null)
        : null;
      setSubmitting(false);
      if (check && !check.available) {
        setErrors({ phone: PHONE_TAKEN });
        return;
      }
    }
    if (step < LAST_STEP) {
      setStep(step + 1);
      scroll.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      if (!returning) {
        await api("/api/profile/name", {
          method: "PATCH",
          json: {
            name: person.name.trim(),
            lastName: person.lastName.trim(),
            phone: person.phone.trim() ? phoneToE164(person.phoneCountry, person.phone) : null,
          },
        });
      }
      // Keep the "building your plan" moment on screen long enough to read (min 2.6 s).
      await Promise.all([api("/api/onboarding", { json: toPayload(draft, timezone) }), wait(2600)]);
      // A new goal changes targets, the workout plan and everything derived from them.
      void queryClient.invalidateQueries();
      if (!returning) track("onboarding_complete", { platform: "app" });
      setBuilt(true);
      await wait(700);
      router.replace("/onboarding/plan");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && !returning) {
        // The number was taken meanwhile: back to step 1 with the warning.
        setSubmitting(false);
        setStep(0);
        setErrors({ phone: PHONE_TAKEN });
        scroll.current?.scrollTo({ y: 0, animated: false });
        return;
      }
      const details = err instanceof ApiError ? (err.details as { message?: string }[] | undefined) : undefined;
      setServerError(
        details?.[0]?.message ?? (err instanceof Error ? err.message : "Something went wrong. Try again."),
      );
      setSubmitting(false);
    }
  }

  const props = { draft, set, errors };
  return (
    <View style={{ flex: 1, backgroundColor: c.ground }}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 24, paddingBottom: 24, gap: 24 }}
      >
        {step > firstStep || returning ? (
          <BackHeader onBack={back}>
            <ProgressSteps current={step + 1 - firstStep} total={LAST_STEP + 2 - firstStep} />
          </BackHeader>
        ) : (
          <View style={{ minHeight: 44, justifyContent: "center" }}>
            <ProgressSteps current={step + 1 - firstStep} total={LAST_STEP + 2 - firstStep} />
          </View>
        )}
        <View style={{ gap: 8 }}>
          <Text variant="h1">{STEP_TITLES[step]}</Text>
          <Text size={15} color={c.ink2}>
            {STEP_LEADS[step]}
          </Text>
        </View>
        {step === 0 && <DetailsStep person={person} setPerson={setPerson} errors={errors} />}
        {step === 1 && <GoalStep {...props} />}
        {step === 2 && (
          <>
            <FoldSection
              icon={<PersonStanding size={18} color={c.brand} />}
              title="Your body"
              summary={bodySummary(draft)}
              done={bodyDone}
              attention={partHasError(2)}
              open={openPart.body}
              onToggle={() => setOpenPart((o) => ({ ...o, body: !o.body }))}
            >
              <AboutStep {...props} />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !bodyDone }}
                onPress={finishBody}
                style={[styles.nextPart, !bodyDone && { opacity: 0.5 }]}
              >
                <Text weight={600} size={16} color={c.brand}>
                  Next: Food and training
                </Text>
              </Pressable>
            </FoldSection>
            <FoldSection
              icon={<Utensils size={16} color={c.brand} />}
              title="Food and training"
              summary={trainingSummary(draft)}
              done={foodDone}
              attention={partHasError(3)}
              open={openPart.food}
              onToggle={() => setOpenPart((o) => ({ ...o, food: !o.food }))}
            >
              <TrainingStep {...props} />
            </FoldSection>
          </>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        {serverError && <FieldError>{serverError}</FieldError>}
        {Object.values(errors).some(Boolean) ? (
          <Text size={13} color={c.ink2} center>
            Check the highlighted fields above.
          </Text>
        ) : (
          !stepValid && (
            <Text size={13} color={c.ink3} center>
              {continueHint}
            </Text>
          )
        )}
        <Button onPress={next} loading={submitting} style={!stepValid && { opacity: 0.6 }}>
          {step < LAST_STEP ? "Continue" : "Build my plan"}
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

function DetailsStep({
  person,
  setPerson,
  errors,
}: {
  person: PersonDetails;
  setPerson: (key: keyof PersonDetails, value: string) => void;
  errors: PersonProblems;
}) {
  const c = useColors();
  const styles = useStyles();
  const [picking, setPicking] = useState(false);
  const picked = PHONE_COUNTRIES.find((c) => c.iso === person.phoneCountry) ?? PHONE_COUNTRIES[0]!;
  return (
    <View style={{ gap: 20 }}>
      <Field label="First name" error={errors.name}>
        <TextInput
          accessibilityLabel="First name"
          value={person.name}
          onChangeText={(v) => setPerson("name", v)}
          placeholder="e.g. Aarav"
          placeholderTextColor="rgba(107,110,118,0.6)"
          autoComplete="given-name"
          textContentType="givenName"
          autoCapitalize="words"
          maxLength={60}
          style={[styles.textInput, errors.name && styles.textInputError]}
        />
      </Field>
      <Field label="Last name" error={errors.lastName}>
        <TextInput
          accessibilityLabel="Last name"
          value={person.lastName}
          onChangeText={(v) => setPerson("lastName", v)}
          placeholder="e.g. Sharma"
          placeholderTextColor="rgba(107,110,118,0.6)"
          autoComplete="family-name"
          textContentType="familyName"
          autoCapitalize="words"
          maxLength={60}
          style={[styles.textInput, errors.lastName && styles.textInputError]}
        />
      </Field>
      <Field label="Phone number (optional)" error={errors.phone}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Country code, ${picked.name} +${picked.dial}`}
            accessibilityHint="Opens the list of countries"
            onPress={() => setPicking(true)}
            style={[styles.textInput, styles.countryButton]}
          >
            <Text size={22}>{flagEmoji(picked.iso)}</Text>
            <Text weight={600} size={16}>
              +{picked.dial}
            </Text>
            <ChevronDown size={16} color={c.ink3} />
          </Pressable>
          <TextInput
            accessibilityLabel="Phone number, optional"
            value={person.phone}
            onChangeText={(v) => setPerson("phone", v)}
            placeholder={picked.iso === "IN" ? "98765 43210" : "Phone number"}
            placeholderTextColor="rgba(107,110,118,0.6)"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={20}
            style={[styles.textInput, { flex: 1 }, errors.phone && styles.textInputError]}
          />
        </View>
        {!errors.phone && (
          <Text size={13} color={c.ink3}>
            We only use it for your account, never for marketing.
          </Text>
        )}
      </Field>
      <Sheet open={picking} onClose={() => setPicking(false)} title="Country code">
        <View>
          {PHONE_COUNTRIES.map((country) => {
            const selected = country.iso === picked.iso;
            return (
              <Pressable
                key={country.iso}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${country.name}, +${country.dial}`}
                onPress={() => {
                  setPerson("phoneCountry", country.iso);
                  setPicking(false);
                }}
                style={[styles.countryRow, selected && { backgroundColor: c.sunken }]}
              >
                <Text size={22}>{flagEmoji(country.iso)}</Text>
                <Text weight={selected ? 600 : 400} size={16} style={{ flex: 1 }}>
                  {country.name}
                </Text>
                <Text size={15} color={c.ink3}>
                  +{country.dial}
                </Text>
                {selected && <Check size={18} color={c.brand} />}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

/** Names for the Continue hint ("Sex: Choose one"; "Enter your height" stands alone). Web has the same. */
const FIELD_LABELS: Record<string, string> = {
  name: "First name",
  lastName: "Last name",
  phone: "Phone",
  goalType: "Goal",
  targetWeightKg: "Target weight",
  targetBodyFatPct: "Target body fat",
  targetDate: "Target date",
  sex: "Sex",
  birthDate: "Date of birth",
  heightCm: "Height",
  weightKg: "Weight",
  waistCm: "Waist",
  neckCm: "Neck",
  hipCm: "Hip",
  activityLevel: "Activity",
  dietType: "Diet",
  equipment: "Where you train",
  medicalNote: "Medical note",
};

function hintFor(key: string, message: string) {
  const label = FIELD_LABELS[key];
  if (!label || message.toLowerCase().includes(label.toLowerCase().split(" ").pop()!)) return message;
  return `${label}: ${message}`;
}

/** One part of the merged "About you" step: tap the header to fold it open and shut. */
function FoldSection({
  icon,
  title,
  summary,
  done,
  attention,
  open,
  onToggle,
  children,
}: {
  /** Shown in the badge until the part is done (then a tick) or has an error. */
  icon: ReactNode;
  title: string;
  summary: string;
  done: boolean;
  attention: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.fold, open && styles.foldOpen]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}${done ? ", done" : ""}${attention ? ", needs a look" : ""}`}
        onPress={onToggle}
        style={styles.foldHead}
      >
        <View
          style={[
            styles.foldBadge,
            attention
              ? { backgroundColor: c.cautionSoft }
              : done
                ? { backgroundColor: c.brand }
                : { backgroundColor: c.sunken },
          ]}
        >
          {attention ? (
            <Info size={16} color={c.cautionText} />
          ) : done ? (
            <Check size={16} color={c.white} strokeWidth={3} />
          ) : (
            icon
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h2">{title}</Text>
          {!open && (
            <Text size={13} numberOfLines={1} weight={attention ? 600 : 400} color={attention ? c.cautionText : c.ink3}>
              {attention ? "Something here needs a look" : summary || "Not answered yet"}
            </Text>
          )}
        </View>
        <ChevronDown size={20} color={c.ink3} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </Pressable>
      {open && <View style={styles.foldBody}>{children}</View>}
    </View>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text variant="label">{label}</Text>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </View>
  );
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
            {
              value: "FAT_LOSS",
              label: "Lose fat",
              description: "Drop fat, keep your muscle",
              icon: choiceIcon(Scale),
            },
            {
              value: "MUSCLE_GAIN",
              label: "Build muscle",
              description: "A lean surplus with progressive training",
              icon: choiceIcon(Dumbbell),
            },
            {
              value: "RECOMPOSITION",
              label: "Recomposition",
              description: "Stay near your weight, lose fat, gain muscle",
              icon: choiceIcon(Sparkles),
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
  const c = useColors();
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
          <CalendarDays size={20} color={c.brandText} />
          <Text weight={600} color={c.brandText}>
            Choose an exact date
          </Text>
        </Pressable>
      )}
    </Field>
  );
}

function AboutStep({ draft, set, errors }: StepProps) {
  const c = useColors();
  const styles = useStyles();
  const bf = wantsBodyFat(draft);
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
      </View>

      {/* Waist and neck (and hip) give body fat; they're asked only for a body-fat goal. */}
      {bf && (
        <Field label="Body measurements">
          <View style={styles.grid}>
            <View style={styles.cell}>
              <NumberField
                label="Waist"
                unit="cm"
                value={draft.waistCm}
                onValueChange={(v) => set("waistCm", v)}
                error={errors.waistCm}
              />
            </View>
            <View style={styles.cell}>
              <NumberField
                label="Neck"
                unit="cm"
                value={draft.neckCm}
                onValueChange={(v) => set("neckCm", v)}
                error={errors.neckCm}
              />
            </View>
            {draft.sex === "FEMALE" && (
              <View style={styles.cell}>
                <NumberField
                  label="Hip"
                  unit="cm"
                  value={draft.hipCm}
                  onValueChange={(v) => set("hipCm", v)}
                  error={errors.hipCm}
                />
              </View>
            )}
          </View>
          <View style={styles.tip}>
            <Info size={20} color={c.ink2} style={{ marginTop: 2 }} />
            <Text size={13} color={c.ink2} style={{ flex: 1 }}>
              <Text size={13} weight={600}>
                Measuring tip:
              </Text>{" "}
              use a soft tape, standing relaxed. Waist at the navel after breathing out; neck just below the Adam&apos;s
              apple{draft.sex === "FEMALE" ? "; hips at the widest point" : ""}. We use these to estimate your body fat
              for your goal.
            </Text>
          </View>
        </Field>
      )}

      <Field label="How active are you outside workouts?" error={errors.activityLevel}>
        <ChoiceCardGroup
          label="Activity level"
          value={draft.activityLevel}
          onChange={(v) => set("activityLevel", v)}
          options={ACTIVITY_OPTIONS}
        />
      </Field>
    </>
  );
}

function TrainingStep({ draft, set, errors }: StepProps) {
  const c = useColors();
  const styles = useStyles();
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
          options={EQUIPMENT_OPTIONS}
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
          placeholderTextColor={`${c.ink3}99`}
          style={styles.textInput}
        />
        <Text size={13} color={c.ink3}>
          We&apos;ll avoid exercises that load these.
        </Text>
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
      {draft.medicalFlag && (
        <View style={{ gap: 6 }}>
          <Text variant="label">Tell us about it (optional)</Text>
          <TextInput
            accessibilityLabel="Tell us about your medical condition, optional"
            value={draft.medicalNote}
            onChangeText={(v) => set("medicalNote", v)}
            placeholder="e.g. type 2 diabetes, on metformin; 20 weeks pregnant"
            placeholderTextColor="rgba(107,110,118,0.6)"
            multiline
            maxLength={MEDICAL_NOTE_MAX}
            style={[styles.textInput, styles.noteInput, errors.medicalNote && styles.textInputError]}
          />
          {errors.medicalNote ? (
            <FieldError>{errors.medicalNote}</FieldError>
          ) : (
            <Text size={13} color={c.ink3}>
              Private to your account. {draft.medicalNote.length}/{MEDICAL_NOTE_MAX}
            </Text>
          )}
        </View>
      )}
    </>
  );
}

const useStyles = makeStyles((c) => ({
  footer: {
    paddingTop: 12,
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: c.ground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.line,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "47%", flexGrow: 1 },
  tip: { flexDirection: "row", gap: 12, borderRadius: radius.card, backgroundColor: c.sunken, padding: 16 },
  textInputError: { borderColor: c.caution },
  noteInput: { height: 96, paddingTop: 12, textAlignVertical: "top" },
  fold: { borderRadius: radius.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  foldOpen: { borderColor: c.brand, borderWidth: 1.5 },
  foldHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  foldBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  foldBody: {
    gap: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  nextPart: {
    alignSelf: "flex-start",
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: c.sunken,
  },
  countryButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: radius.input,
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
