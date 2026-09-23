"use client";

import {
  Armchair,
  Bike,
  ChevronLeft,
  Dumbbell,
  Footprints,
  Info,
  Medal,
  Scale,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { StickyFooter } from "@/components/sticky-footer";
import {
  Button,
  ChipGroup,
  ChoiceCardGroup,
  DateField,
  NumberField,
  ProgressSteps,
  Segmented,
  Switch,
} from "@/components/ui";
import {
  emptyDraft,
  needsTarget,
  toPayload,
  validateStep,
  wantsBodyFat,
  ymd,
  type DraftErrors,
  type OnboardingDraft,
} from "./draft";

export type { OnboardingDraft };

const ic = "size-5";

const STEP_TITLES = ["What's your goal?", "About you", "Diet and training"];

export function OnboardingForm({
  initial,
  returning,
}: {
  initial: Partial<OnboardingDraft>;
  returning: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({ ...emptyDraft(), ...initial }));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitting, setSubmitting] = useState(false);
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
      document
        .querySelector("[aria-invalid=true], [data-error]")
        ?.scrollIntoView({ block: "center" });
      return;
    }
    if (step < 3) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          toPayload(draft, Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"),
        ),
      });
      if (res.status === 401) return router.push("/login");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setServerError(
          body?.details?.[0]?.message ?? body?.error ?? "Something went wrong. Try again.",
        );
        setSubmitting(false);
        return;
      }
      router.push("/onboarding/plan");
      router.refresh();
    } catch {
      setServerError("Couldn't reach FitLens. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col px-6 pt-4">
      <div className="flex items-center gap-2">
        {(step > 1 || returning) && (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="-ml-3 grid size-11 place-items-center rounded-full text-ink hover:bg-sunken"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        <ProgressSteps current={step} total={4} className="flex-1" />
      </div>

      <h1 className="mt-6 display text-[28px] leading-tight">{STEP_TITLES[step - 1]}</h1>

      <div className="mt-6 flex flex-col gap-6 pb-6">
        {step === 1 && <GoalStep draft={draft} set={set} errors={errors} />}
        {step === 2 && <AboutStep draft={draft} set={set} errors={errors} />}
        {step === 3 && <TrainingStep draft={draft} set={set} errors={errors} />}
      </div>

      <StickyFooter>
        {serverError && (
          <p role="alert" className="mb-3 text-center text-[13px] font-semibold text-brand">
            {serverError}
          </p>
        )}
        <Button variant="primary" onClick={next} disabled={submitting}>
          {step < 3 ? "Continue" : submitting ? "Building your plan…" : "See my plan"}
        </Button>
      </StickyFooter>
    </main>
  );
}

type StepProps = {
  draft: OnboardingDraft;
  set: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  errors: DraftErrors;
};

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5" data-error={error ? "" : undefined}>
      <legend className="mb-2.5 text-[13px] font-semibold text-ink-2">{label}</legend>
      {children}
      {error && <p className="text-[13px] font-semibold text-brand">{error}</p>}
    </fieldset>
  );
}

function GoalStep({ draft, set, errors }: StepProps) {
  const today = new Date();
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
              icon: <Scale className={ic} />,
            },
            {
              value: "MUSCLE_GAIN",
              label: "Build muscle",
              description: "A lean surplus with progressive training",
              icon: <Dumbbell className={ic} />,
            },
            {
              value: "RECOMPOSITION",
              label: "Recomposition",
              description: "Stay near your weight, lose fat, gain muscle",
              icon: <Sparkles className={ic} />,
            },
          ]}
        />
      </Field>

      {needsTarget(draft) && (
        <div className="flex flex-col gap-3">
          <Segmented
            label="Target type"
            value={draft.targetMode}
            onChange={(v) => set("targetMode", v)}
            options={[
              { value: "WEIGHT", label: "Target weight" },
              { value: "BODY_FAT", label: "Target body fat" },
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
        </div>
      )}

      <DateField
        label="Target date"
        value={draft.targetDate}
        min={ymd(new Date(today.getTime() + 14 * 86_400_000))}
        onValueChange={(v) => set("targetDate", v)}
        error={errors.targetDate}
        hint="We'll tell you if it's too fast and suggest a safer date."
      />
    </>
  );
}

function AboutStep({ draft, set, errors }: StepProps) {
  const bf = wantsBodyFat(draft);
  const optional = bf ? "" : " (optional)";
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
        max={ymd(new Date())}
        onValueChange={(v) => set("birthDate", v)}
        error={errors.birthDate}
      />

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Height"
          unit="cm"
          placeholder="170"
          value={draft.heightCm}
          onValueChange={(v) => set("heightCm", v)}
          error={errors.heightCm}
        />
        <NumberField
          label="Weight"
          unit="kg"
          placeholder="75"
          value={draft.weightKg}
          onValueChange={(v) => set("weightKg", v)}
          error={errors.weightKg}
        />
        <NumberField
          label={`Waist${optional}`}
          unit="cm"
          value={draft.waistCm}
          onValueChange={(v) => set("waistCm", v)}
          error={errors.waistCm}
        />
        <NumberField
          label={`Neck${optional}`}
          unit="cm"
          value={draft.neckCm}
          onValueChange={(v) => set("neckCm", v)}
          error={errors.neckCm}
        />
        {draft.sex === "FEMALE" && (
          <NumberField
            label={`Hip${optional}`}
            unit="cm"
            value={draft.hipCm}
            onValueChange={(v) => set("hipCm", v)}
            error={errors.hipCm}
          />
        )}
      </div>

      <div className="flex gap-3 rounded-card bg-sunken p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-ink-2" aria-hidden />
        <p className="text-[13px] text-ink-2">
          <span className="font-semibold text-ink">Measuring tip:</span> use a soft tape, standing
          relaxed. Waist at the navel after breathing out; neck just below the Adam&apos;s apple
          {draft.sex === "FEMALE" ? "; hips at the widest point" : ""}. We use these to estimate
          body fat.
        </p>
      </div>

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
              icon: <Armchair className={ic} />,
            },
            {
              value: "LIGHT",
              label: "Lightly active",
              description: "5–8k steps, some walking",
              icon: <Footprints className={ic} />,
            },
            {
              value: "MODERATE",
              label: "Moderately active",
              description: "8–12k steps or an active job",
              icon: <Bike className={ic} />,
            },
            {
              value: "VERY_ACTIVE",
              label: "Very active",
              description: "On your feet all day or hard training",
              icon: <Medal className={ic} />,
            },
            {
              value: "ATHLETE",
              label: "Athlete",
              description: "Twice-a-day training or heavy labour",
              icon: <Trophy className={ic} />,
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

      <Field label="Training experience" error={errors.experience}>
        <ChipGroup
          label="Training experience"
          value={draft.experience}
          onChange={(v) => set("experience", v)}
          options={[
            { value: "BEGINNER", label: "New to it" },
            { value: "INTERMEDIATE", label: "1–3 years" },
            { value: "ADVANCED", label: "3+ years" },
          ]}
        />
      </Field>

      <Field label="Equipment" error={errors.equipment}>
        <ChipGroup
          label="Equipment"
          value={draft.equipment}
          onChange={(v) => set("equipment", v)}
          options={[
            { value: "FULL_GYM", label: "Full gym" },
            { value: "DUMBBELLS", label: "Dumbbells at home" },
            { value: "BODYWEIGHT", label: "No equipment" },
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

      <Field label="Session length">
        <ChipGroup
          label="Session length"
          value={draft.sessionMinutes}
          onChange={(v) => set("sessionMinutes", v)}
          options={[30, 45, 60, 75, 90].map((n) => ({ value: n, label: `${n} min` }))}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="injuries" className="text-[13px] font-semibold text-ink-2">
          Injuries or pain (optional)
        </label>
        <input
          id="injuries"
          value={draft.injuries}
          onChange={(e) => set("injuries", e.target.value)}
          placeholder="e.g. left knee, lower back"
          className="h-[52px] rounded-input border border-line-strong bg-surface px-4 text-base outline-none focus:border-ink"
        />
        <p className="text-[13px] text-ink-3">We&apos;ll avoid exercises that load these.</p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-card bg-surface p-4">
        <div className="flex flex-col">
          <span id="medical-label" className="font-semibold">
            Medical condition or pregnancy
          </span>
          <span className="text-[13px] text-ink-3">
            We&apos;ll keep calories at maintenance. Check with your doctor.
          </span>
        </div>
        <Switch
          checked={draft.medicalFlag}
          onChange={(v) => set("medicalFlag", v)}
          labelledBy="medical-label"
        />
      </div>
    </>
  );
}
