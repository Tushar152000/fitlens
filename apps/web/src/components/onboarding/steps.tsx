"use client";

import {
  ChevronDown,
  Armchair,
  Bike,
  CalendarDays,
  Dumbbell,
  Footprints,
  House,
  Info,
  Medal,
  Scale,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  flagEmoji,
  PHONE_COUNTRIES,
  type PersonDetails,
  type PersonProblems,
} from "@fitr8/domain/person";
import {
  ChipGroup,
  ChoiceCardGroup,
  DateField,
  FieldError,
  NumberField,
  Segmented,
  TileGroup,
} from "@/components/ui";
import {
  MEDICAL_NOTE_MAX,
  needsTarget,
  wantsBodyFat,
  ymd,
  type DraftErrors,
  type OnboardingDraft,
} from "@/lib/onboarding/draft";

const ic = "size-5";

/** Marks an answer carried over from the landing-page calculator. */
function FromHome() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-fitr8-lilac-soft px-2 py-0.5 text-[11px] font-bold text-fitr8">
      <Sparkles className="size-3" aria-hidden />
      From the home page
    </span>
  );
}

/** Step 1, "Your details": first and last name (required) and an optional phone number. */
export function NameStep({
  person,
  setPerson,
  errors,
}: {
  person: PersonDetails;
  setPerson: (key: keyof PersonDetails, value: string) => void;
  errors: PersonProblems;
}) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid gap-[18px] sm:grid-cols-2">
        <TextField
          id="ob-name"
          label="First name"
          autoComplete="given-name"
          autoFocus
          placeholder="e.g. Aarav"
          value={person.name}
          onChange={(v) => setPerson("name", v)}
          error={errors.name}
        />
        <TextField
          id="ob-last-name"
          label="Last name"
          autoComplete="family-name"
          placeholder="e.g. Sharma"
          value={person.lastName}
          onChange={(v) => setPerson("lastName", v)}
          error={errors.lastName}
        />
      </div>
      <PhoneField
        country={person.phoneCountry}
        setCountry={(v) => setPerson("phoneCountry", v)}
        phone={person.phone}
        setPhone={(v) => setPerson("phone", v)}
        error={errors.phone}
      />
    </div>
  );
}

const inputBox =
  "h-[54px] rounded-input border border-line-strong bg-surface text-lg font-semibold outline-none";

/** Country picker (flag + calling code) joined to the number box. */
function PhoneField({
  country,
  setCountry,
  phone,
  setPhone,
  error,
}: {
  country: string;
  setCountry: (iso: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  error?: string;
}) {
  const picked = PHONE_COUNTRIES.find((c) => c.iso === country) ?? PHONE_COUNTRIES[0]!;
  const described = error ? "ob-phone-error" : "ob-phone-hint";
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor="ob-phone" className="text-sm font-semibold text-ink-2">
        Phone number (optional)
      </label>
      <div className="flex gap-2">
        {/* A real <select> for keyboard and screen readers, drawn as "🇮🇳 +91 ⌄". */}
        <div
          className={cn(
            inputBox,
            "relative flex shrink-0 items-center gap-1.5 px-3.5 focus-within:border-fitr8 focus-within:ring-3 focus-within:ring-fitr8-lilac-soft",
          )}
        >
          <span aria-hidden className="text-[22px] leading-none">
            {flagEmoji(picked.iso)}
          </span>
          <span aria-hidden className="tabular-nums">
            +{picked.dial}
          </span>
          <ChevronDown aria-hidden className="size-4 text-ink-3" />
          <select
            aria-label="Country code"
            value={picked.iso}
            onChange={(e) => setCountry(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {PHONE_COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {flagEmoji(c.iso)} {c.name} (+{c.dial})
              </option>
            ))}
          </select>
        </div>
        <input
          id="ob-phone"
          suppressHydrationWarning
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={20}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={picked.iso === "IN" ? "98765 43210" : "Phone number"}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={cn(
            inputBox,
            "w-full min-w-0 px-4 tabular-nums placeholder:font-medium placeholder:text-ink-3/60 focus:border-fitr8 focus:ring-3 focus:ring-fitr8-lilac-soft",
          )}
        />
      </div>
      {error ? (
        <FieldError id="ob-phone-error">{error}</FieldError>
      ) : (
        <p id="ob-phone-hint" className="text-[13px] text-ink-3">
          We only use it for your account, never for marketing.
        </p>
      )}
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  ...input
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
} & Pick<
  React.InputHTMLAttributes<HTMLInputElement>,
  "autoComplete" | "autoFocus" | "placeholder"
>) {
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {label}
      </label>
      <input
        {...input}
        id={id}
        suppressHydrationWarning
        maxLength={60}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          inputBox,
          "min-w-0 px-4 placeholder:font-medium placeholder:text-ink-3/60 focus:border-fitr8 focus:ring-3 focus:ring-fitr8-lilac-soft",
        )}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

/**
 * "About you" lays its fields out as a two-column grid from md (FoldSection); these span both
 * columns. The rest pairs up (sex | date of birth).
 */
const FULL = "md:col-span-2";

export type StepProps = {
  draft: OnboardingDraft;
  set: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  errors: DraftErrors;
  /** Fields filled in from the landing-page calculator, marked until the user changes them. */
  prefilled?: ReadonlySet<keyof OnboardingDraft>;
};

function Field({
  label,
  error,
  fromHome,
  className,
  children,
}: {
  label: string;
  error?: string;
  fromHome?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset
      className={cn("flex min-w-0 flex-col gap-2.5", className)}
      data-error={error ? "" : undefined}
    >
      <legend className="mb-2.5 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink-2">
        {label}
        {fromHome && <FromHome />}
      </legend>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </fieldset>
  );
}

export function GoalStep({ draft, set, errors, prefilled }: StepProps) {
  return (
    <>
      <Field label="Pick one" error={errors.goalType} fromHome={prefilled?.has("goalType")}>
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
          <p className="text-[13px] font-semibold text-ink-2">Aim for</p>
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
        </div>
      )}

      <ByWhen draft={draft} set={set} error={errors.targetDate} />
    </>
  );
}

export function AboutStep({
  draft,
  set,
  errors,
  prefilled,
  ageHint,
}: StepProps & { ageHint?: number | null }) {
  const bf = wantsBodyFat(draft);
  return (
    <>
      <Field label="Sex" error={errors.sex} fromHome={prefilled?.has("sex")}>
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
        hint={ageHint ? `On the home page you said you’re ${ageHint}.` : undefined}
      />

      <div className={cn("grid grid-cols-2 gap-3", FULL)}>
        <NumberField
          label={prefilled?.has("heightCm") ? "Height · from home page" : "Height"}
          unit="cm"
          placeholder="170"
          value={draft.heightCm}
          onValueChange={(v) => set("heightCm", v)}
          error={errors.heightCm}
        />
        <NumberField
          label={prefilled?.has("weightKg") ? "Weight · from home page" : "Weight"}
          unit="kg"
          placeholder="75"
          value={draft.weightKg}
          onValueChange={(v) => set("weightKg", v)}
          error={errors.weightKg}
        />
      </div>

      {/* Waist and neck (and hip) give body fat; they're asked only for a body-fat goal. */}
      {bf && (
        <Field label="Body measurements" className={FULL}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <NumberField
              label="Waist"
              unit="cm"
              value={draft.waistCm}
              onValueChange={(v) => set("waistCm", v)}
              error={errors.waistCm}
            />
            <NumberField
              label="Neck"
              unit="cm"
              value={draft.neckCm}
              onValueChange={(v) => set("neckCm", v)}
              error={errors.neckCm}
            />
            {draft.sex === "FEMALE" && (
              <NumberField
                label="Hip"
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
              <span className="font-semibold text-ink">Measuring tip:</span> use a soft tape,
              standing relaxed. Waist at the navel after breathing out; neck just below the
              Adam&apos;s apple{draft.sex === "FEMALE" ? "; hips at the widest point" : ""}. We use
              these to estimate your body fat for your goal.
            </p>
          </div>
        </Field>
      )}

      <Field
        label="How active are you outside workouts?"
        error={errors.activityLevel}
        fromHome={prefilled?.has("activityLevel")}
        className={FULL}
      >
        <ChoiceCardGroup
          label="Activity level"
          className="md:grid md:grid-cols-2"
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
              description: "Twice-a-day training or a very physical job",
              icon: <Trophy className={ic} />,
            },
          ]}
        />
      </Field>
    </>
  );
}

const WEEK_OPTIONS = [12, 16, 24];

/** Design 2: "By when?" — three quick tiles with end dates, or an exact date. */
function ByWhen({
  draft,
  set,
  error,
}: {
  draft: OnboardingDraft;
  set: StepProps["set"];
  error?: string;
}) {
  const today = new Date();
  const dateIn = (weeks: number) => ymd(new Date(today.getTime() + weeks * 7 * 86_400_000));
  const short = (d: string) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(d),
    );
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
        options={WEEK_OPTIONS.map((w) => ({
          value: w,
          label: `${w} weeks`,
          sub: short(dateIn(w)),
        }))}
      />
      {exact ? (
        <DateField
          label="Exact date"
          value={draft.targetDate}
          min={dateIn(2)}
          onValueChange={(v) => set("targetDate", v)}
          error={error}
          hint="We'll tell you if it's too fast and suggest a safer date."
        />
      ) : (
        <button
          type="button"
          onClick={() => setExact(true)}
          className="flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-brand"
        >
          <CalendarDays className="size-5" aria-hidden />
          Choose an exact date
        </button>
      )}
    </Field>
  );
}

export function TrainingStep({ draft, set, errors }: StepProps) {
  return (
    <>
      <Field label="Diet" error={errors.dietType} className={FULL}>
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

      <Field label="Where I train" error={errors.equipment} className={FULL}>
        <TileGroup
          label="Where I train"
          value={draft.equipment}
          onChange={(v) => set("equipment", v)}
          options={[
            {
              value: "FULL_GYM",
              label: "Gym",
              sub: "Machines, barbells",
              icon: <Dumbbell className={ic} />,
            },
            {
              value: "DUMBBELLS",
              label: "Home",
              sub: "A few dumbbells",
              icon: <House className={ic} />,
            },
            {
              value: "BODYWEIGHT",
              label: "Anywhere",
              sub: "No equipment",
              icon: <Footprints className={ic} />,
            },
          ]}
        />
      </Field>

      <Field label="Days per week" className={FULL}>
        <ChipGroup
          label="Days per week"
          value={draft.trainingDaysPerWeek}
          onChange={(v) => set("trainingDaysPerWeek", v)}
          options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} days` }))}
        />
      </Field>

      <Field label="Minutes per session" className={FULL}>
        <Segmented
          label="Minutes per session"
          value={String(Math.min(60, Math.max(30, Math.round(draft.sessionMinutes / 15) * 15)))}
          onChange={(v) => set("sessionMinutes", Number(v))}
          options={["30", "45", "60"].map((n) => ({ value: n, label: `${n} min` }))}
        />
      </Field>

      <div className={cn("flex flex-col gap-1.5", FULL)}>
        <label htmlFor="injuries" className="text-[13px] font-semibold text-ink-2">
          Injuries or pain (optional)
        </label>
        <input
          suppressHydrationWarning
          id="injuries"
          value={draft.injuries}
          onChange={(e) => set("injuries", e.target.value)}
          placeholder="e.g. left knee, lower back"
          className="h-[52px] rounded-input border border-line-strong bg-surface px-4 text-base outline-none focus:border-ink"
        />
        <p className="text-[13px] text-ink-3">We&apos;ll avoid exercises that load these.</p>
      </div>

      <div
        className={cn(
          "flex flex-col gap-4 rounded-card bg-surface p-4 shadow-[0_0_0_1px_var(--color-line)]",
          FULL,
        )}
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            suppressHydrationWarning
            type="checkbox"
            checked={draft.medicalFlag}
            onChange={(e) => set("medicalFlag", e.target.checked)}
            aria-controls="medical-note"
            aria-expanded={draft.medicalFlag}
            className="mt-0.5 size-6 shrink-0 cursor-pointer accent-fitr8"
          />
          <span className="flex flex-col">
            <span className="font-semibold">
              I have a medical condition, am pregnant, or am under 18
            </span>
            <span className="text-[13px] text-ink-3">
              We&apos;ll keep calories at maintenance instead of a deficit. Check with your doctor.
            </span>
          </span>
        </label>
        {draft.medicalFlag && (
          <div className="flex animate-page-in flex-col gap-1.5 pl-9">
            <label htmlFor="medical-note" className="text-[13px] font-semibold text-ink-2">
              Tell us about it (optional)
            </label>
            <textarea
              id="medical-note"
              rows={3}
              maxLength={MEDICAL_NOTE_MAX}
              value={draft.medicalNote}
              onChange={(e) => set("medicalNote", e.target.value)}
              placeholder="e.g. type 2 diabetes, on metformin; 20 weeks pregnant"
              aria-invalid={errors.medicalNote ? true : undefined}
              aria-describedby="medical-note-hint"
              className="resize-y rounded-input border border-line-strong bg-surface px-4 py-3 text-base outline-none placeholder:text-ink-3/60 focus:border-ink"
            />
            {errors.medicalNote ? (
              <FieldError id="medical-note-hint">{errors.medicalNote}</FieldError>
            ) : (
              <p
                id="medical-note-hint"
                className="flex justify-between gap-3 text-[13px] text-ink-3"
              >
                <span>Private to your account. It helps keep your plan safe.</span>
                <span className="tabular-nums">
                  {draft.medicalNote.length}/{MEDICAL_NOTE_MAX}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
