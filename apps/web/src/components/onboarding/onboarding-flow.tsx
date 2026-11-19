"use client";

import { ArrowLeft, ArrowRight, PersonStanding, Sparkles, Utensils } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { track } from "@/lib/client/analytics";
import { api, ApiError } from "@/lib/client/api";
import {
  emptyDraft,
  toPayload,
  validateStep,
  type DraftErrors,
  type OnboardingDraft,
} from "@/lib/onboarding/draft";
import { estimateFromDraft } from "@/lib/onboarding/estimate";
import { CALCULATOR_KEY, draftFromCalculator, parseCalculator } from "@/lib/onboarding/pending";
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_TAKEN,
  personProblems,
  phoneToE164,
  type PersonDetails,
  type PersonProblems,
} from "@fitr8/domain/person";
import type { PhoneCheckDto } from "@fitr8/contracts";
import { PlanBuilding } from "./plan-building";
import { FoldSection } from "./fold-section";
import { bodySummary, trainingSummary } from "@/lib/onboarding/summary";
import { onboardingButton } from "./button-styles";
import { OnboardingShell } from "./shell";
import { estimateLine, RAIL, SETUP_STEPS, type OnboardingMode } from "./steps-meta";
import { AboutStep, GoalStep, NameStep, TrainingStep } from "./steps";

type FormStep = "name" | "goal" | "about";
/** Everyone is signed in by now (Google comes first, at /login). */
const FORM: Record<OnboardingMode, FormStep[]> = {
  new: ["name", "goal", "about"],
  edit: ["goal", "about"],
};
/** Draft steps (`validateStep` 1–3) each form step checks: "about" is body + food and training. */
const DRAFT_STEPS: Partial<Record<FormStep, number[]>> = { goal: [1], about: [2, 3] };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The landing-page calculator hands its numbers over in sessionStorage, which the server can't
// see: read it as an external store so the first client render matches the server, then remount.
const noSubscribe = () => () => {};
function readStored(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The onboarding form, signed in: first time ("new") or changing the goal ("edit"). docs/WEBSITE.md §3. */
export function OnboardingFlow(props: {
  mode: OnboardingMode;
  initial?: Partial<OnboardingDraft>;
  initialPerson?: Partial<PersonDetails>;
}) {
  const calculatorRaw = useSyncExternalStore(
    noSubscribe,
    () => (props.mode === "edit" ? null : readStored(CALCULATOR_KEY)),
    () => null,
  );
  return <Flow key={calculatorRaw ?? ""} {...props} calculatorRaw={calculatorRaw} />;
}

function Flow({
  mode,
  initial,
  initialPerson,
  calculatorRaw,
}: {
  mode: OnboardingMode;
  initial?: Partial<OnboardingDraft>;
  initialPerson?: Partial<PersonDetails>;
  calculatorRaw: string | null;
}) {
  const router = useRouter();
  const steps = FORM[mode];
  const calc = parseCalculator(calculatorRaw);
  const fromCalc = calc ? draftFromCalculator(calc) : {};

  const [index, setIndex] = useState(0);
  const [reached, setReached] = useState(0);
  const [person, setPersonState] = useState<PersonDetails>({
    name: "",
    lastName: "",
    phoneCountry: DEFAULT_PHONE_COUNTRY,
    phone: "",
    ...initialPerson,
  });
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    ...emptyDraft(),
    ...fromCalc,
    ...initial,
  }));
  const [prefilled, setPrefilled] = useState<Set<keyof OnboardingDraft>>(
    () =>
      new Set(
        Object.keys(fromCalc).filter(
          (k) => !initial?.[k as keyof OnboardingDraft],
        ) as (keyof OnboardingDraft)[],
      ),
  );
  const [errors, setErrors] = useState<DraftErrors & PersonProblems>({});
  const [checking, setChecking] = useState(false);
  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const step = steps[index];
  const ageHint = calc && !draft.birthDate ? calc.ageYears : null;
  const est = estimateFromDraft(draft, { fallbackAgeYears: calc?.ageYears ?? null });

  const set = <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setPrefilled((p) => {
      if (!p.has(key)) return p;
      const next = new Set(p);
      next.delete(key);
      return next;
    });
  };

  /** Step 1 as the API takes it: trimmed names, phone in E.164 or null. */
  const personPayload = () => ({
    name: person.name.trim(),
    lastName: person.lastName.trim(),
    phone: person.phone.trim() ? phoneToE164(person.phoneCountry, person.phone) : null,
  });

  const setPerson = (key: keyof PersonDetails, value: string) => {
    setPersonState((p) => ({ ...p, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // "About you" folds into two parts; "Your body" starts open.
  const [openPart, setOpenPart] = useState({ body: true, food: false });
  const bodyDone = Object.keys(validateStep(2, draft)).length === 0;
  const foodDone = Object.keys(validateStep(3, draft)).length === 0;
  const partHasError = (n: 2 | 3) =>
    Object.keys(validateStep(n, draft)).some((k) => errors[k as keyof typeof errors]);

  /** Opens one part on its own and brings it into view (rail sub-steps, "Next"). */
  function showPart(part: "body" | "food") {
    setOpenPart({ body: part === "body", food: part === "food" });
    requestAnimationFrame(() =>
      document
        .getElementById(`part-${part}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  // The rail lists the two parts of "About you" under it.
  const substeps =
    step === "about"
      ? [
          {
            label: "Your body",
            done: bodyDone,
            current: openPart.body,
            onSelect: () => showPart("body"),
          },
          {
            label: "Food and training",
            done: foodDone,
            current: openPart.food && !openPart.body,
            onSelect: () => showPart("food"),
          },
        ]
      : undefined;

  /** "Next: Food and training": check the body part, then fold it and open the next. */
  function finishBody() {
    const found = validateStep(2, draft);
    if (Object.keys(found).length) {
      setErrors(found);
      requestAnimationFrame(() =>
        document
          .querySelector("[aria-invalid=true], [data-error]")
          ?.scrollIntoView({ block: "center" }),
      );
      return;
    }
    showPart("food");
  }

  function go(i: number) {
    setErrors({});
    setIndex(i);
    setReached((r) => Math.max(r, i));
    window.scrollTo({ top: 0 });
  }

  function startBlank() {
    setDraft((d) => {
      const next = { ...d };
      for (const k of prefilled)
        if (k !== "goalType") (next as Record<string, unknown>)[k] = undefined;
      return { ...next, heightCm: "", weightKg: "" };
    });
    setPrefilled(new Set());
  }

  async function next() {
    const found: DraftErrors & PersonProblems =
      step === "name"
        ? personProblems(person)
        : Object.assign({}, ...(DRAFT_STEPS[step] ?? []).map((n) => validateStep(n, draft)));
    if (Object.keys(found).length) {
      setErrors(found);
      // Open whichever part of "About you" holds the problem so it can be seen.
      if (step === "about")
        setOpenPart((o) => ({ body: o.body || !bodyDone, food: o.food || !foodDone }));
      requestAnimationFrame(() =>
        document
          .querySelector("[aria-invalid=true], [data-error]")
          ?.scrollIntoView({ block: "center" }),
      );
      return;
    }
    // Warn now if another account has the number (the save refuses it too: 409).
    const phone = step === "name" ? personPayload().phone : null;
    if (phone) {
      setChecking(true);
      const check = await api<PhoneCheckDto>(
        `/api/profile/phone-check?phone=${encodeURIComponent(phone)}`,
      ).catch(() => null); // Offline etc.: the save itself refuses a taken number (409).
      setChecking(false);
      if (check && !check.available) {
        setErrors({ phone: PHONE_TAKEN });
        return;
      }
    }
    if (index < steps.length - 1) return go(index + 1);
    await submit();
  }

  // Signed in: save now, behind the "Building your plan" moment (at least 2.6 s).
  async function submit() {
    setBuilding(true);
    setServerError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      // Signed in from the start ("new"): step 1 is saved here, before the plan.
      if (steps.includes("name")) {
        await api("/api/profile/name", { method: "PATCH", json: personPayload() });
      }
      await Promise.all([
        api("/api/onboarding", { method: "POST", json: toPayload(draft, timezone) }),
        wait(2600),
      ]);
      if (mode !== "edit") track("onboarding_complete", { platform: "web" });
      setBuilt(true);
      await wait(700);
      router.push(`/onboarding/plan?flow=${mode}`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && steps.includes("name")) {
        // The number was taken meanwhile: back to step 1 with the warning.
        setBuilding(false);
        go(0);
        setErrors({ phone: PHONE_TAKEN });
        return;
      }
      const details =
        e instanceof ApiError ? (e.details as { message?: string }[] | undefined) : undefined;
      setServerError(
        details?.[0]?.message ??
          (e instanceof Error ? e.message : "Something went wrong. Try again."),
      );
      setBuilding(false);
    }
  }

  const hasErrors = Object.values(errors).some(Boolean);
  /** What still blocks this step, in field order (body before food on "About you"). */
  const problems: DraftErrors & PersonProblems =
    step === "name"
      ? personProblems(person)
      : step === "goal"
        ? validateStep(1, draft)
        : { ...validateStep(2, draft), ...validateStep(3, draft) };
  const stepValid = Object.keys(problems).length === 0;
  // The hint names the first thing to fix, so a filled-in but rejected field never looks stuck.
  const firstProblem = Object.entries(problems).find(([, message]) => message);
  const continueHint = firstProblem ? hintFor(firstProblem[0], firstProblem[1]) : null;
  const stepNo = `Step ${index + 1} of ${steps.length}`;
  const greeting = person.name.trim() ? `, ${person.name.trim().split(" ")[0]}` : "";

  return (
    <OnboardingShell
      steps={RAIL[mode]}
      current={index}
      reached={reached}
      setupSteps={SETUP_STEPS[mode]}
      onStep={(i) => go(i)}
      split
      substeps={substeps}
      estimate={
        est && {
          ...est,
          line: estimateLine({ ...est, targetDate: draft.targetDate }),
        }
      }
      footer={
        <>
          {serverError && (
            <p role="alert" className="text-center text-[13px] font-semibold text-caution-text">
              {serverError}
            </p>
          )}
          {hasErrors ? (
            <p role="alert" className="text-center text-[13px] text-ink-2">
              Check the highlighted fields above.
            </p>
          ) : (
            !stepValid && (
              <p id="continue-hint" className="text-center text-[13px] text-ink-3">
                {continueHint}
              </p>
            )
          )}
          <div className="flex gap-2.5">
            {(index > 0 || mode === "edit") && (
              <button
                type="button"
                onClick={() => (index > 0 ? go(index - 1) : router.back())}
                aria-label="Back"
                className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-sunken"
              >
                <ArrowLeft className="size-5" />
              </button>
            )}
            {/* The pill is full width and won't shrink; this box shares the row with Back. */}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={next}
                // Looks disabled until the step is valid, but a click still runs the checks:
                // it highlights what's wrong instead of doing nothing.
                disabled={building || checking}
                aria-disabled={!stepValid}
                aria-describedby={!stepValid ? "continue-hint" : undefined}
                className={cn(onboardingButton, NOT_READY)}
              >
                {index === steps.length - 1 ? "Build my plan" : "Continue"}
                <ArrowRight className="size-5" aria-hidden />
              </button>
            </div>
          </div>
        </>
      }
    >
      {step === "name" && (
        <>
          <Heading
            kicker={stepNo}
            title="First, what can we call you?"
            lead="A few quick questions and you’ll have daily calories, macros and a training week built for you."
          />
          <StepBody>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void next();
              }}
            >
              <NameStep person={person} setPerson={setPerson} errors={errors} />
              {/* Enter in any field continues. */}
              <button type="submit" hidden aria-hidden tabIndex={-1} />
            </form>
          </StepBody>
        </>
      )}

      {step === "goal" && (
        <>
          <Heading
            kicker={mode === "edit" ? "Edit your plan" : stepNo}
            title={`What’s your goal${greeting}?`}
            lead={STEP_LEADS.goal}
          />
          <StepBody>
            <GoalStep draft={draft} set={set} errors={errors} prefilled={prefilled} />
          </StepBody>
        </>
      )}

      {step === "about" && (
        <>
          <Heading
            kicker={mode === "edit" ? "Edit your plan" : stepNo}
            title="About you"
            lead={STEP_LEADS.about}
          />
          <StepBody>
            {prefilled.size > 0 && (
              <p className="flex items-start gap-3 rounded-2xl bg-fitr8-lilac-soft px-3.5 py-3 text-sm text-ink-2">
                <Sparkles className="mt-0.5 size-[18px] shrink-0 text-fitr8" aria-hidden />
                <span>
                  We filled in what you entered on the home page. Check it before you continue, or{" "}
                  <button
                    type="button"
                    onClick={startBlank}
                    className="font-semibold text-fitr8 underline underline-offset-3"
                  >
                    start blank
                  </button>
                  .
                </span>
              </p>
            )}
            <FoldSection
              id="part-body"
              icon={<PersonStanding className="size-[18px]" />}
              title="Your body"
              summary={bodySummary(draft)}
              done={bodyDone}
              attention={partHasError(2)}
              open={openPart.body}
              onToggle={() => setOpenPart((o) => ({ ...o, body: !o.body }))}
            >
              <AboutStep
                draft={draft}
                set={set}
                errors={errors}
                prefilled={prefilled}
                ageHint={ageHint}
              />
              <button
                type="button"
                onClick={finishBody}
                aria-disabled={!bodyDone}
                className="inline-flex h-12 items-center justify-center gap-2 justify-self-start rounded-full bg-fitr8-lilac-soft px-5 font-semibold text-fitr8 hover:bg-fitr8-lilac-soft/70 aria-disabled:opacity-50 md:col-span-2"
              >
                Next: Food and training
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </FoldSection>
            <FoldSection
              id="part-food"
              icon={<Utensils className="size-4" />}
              title="Food and training"
              summary={trainingSummary(draft)}
              done={foodDone}
              attention={partHasError(3)}
              open={openPart.food}
              onToggle={() => setOpenPart((o) => ({ ...o, food: !o.food }))}
            >
              <TrainingStep draft={draft} set={set} errors={errors} />
            </FoldSection>
          </StepBody>
        </>
      )}

      {building && <PlanBuilding done={built} />}
    </OnboardingShell>
  );
}

/** The line under each plan step's title (the app shows the same words). */
const STEP_LEADS = {
  goal: "Pick what you want and by when. We’ll check the pace is safe and set your daily calories.",
  about:
    "Your body, food and training decide your calories, macros and training week. Only you can see them.",
} as const;

/** Names for the Continue hint ("Weight: That's already your target weight…"). */
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

/** "Enter your height" stands alone; "Choose one" gets its field: "Sex: Choose one". */
function hintFor(key: string, message: string) {
  const label = FIELD_LABELS[key];
  if (!label || message.toLowerCase().includes(label.toLowerCase().split(" ").pop()!))
    return message;
  return `${label}: ${message}`;
}

/** Continue while the step isn't valid yet: dimmed, no lift on hover, still clickable. */
const NOT_READY =
  "aria-disabled:opacity-60 aria-disabled:shadow-none aria-disabled:hover:translate-0 aria-disabled:hover:bg-fitr8";

/** A step's fields: one child, so the shell's landscape layout puts them in the right column. */
function StepBody({ children }: { children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-6 lg:gap-7">{children}</div>;
}

function Heading({ kicker, title, lead }: { kicker: string; title: string; lead?: string }) {
  return (
    <div>
      <p className="text-[13px] font-bold tracking-[0.08em] text-fitr8 uppercase">{kicker}</p>
      <h1 className="mt-1.5 text-[30px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance lg:text-[38px]">
        {title}
      </h1>
      {lead && <p className="mt-2 text-ink-2">{lead}</p>}
    </div>
  );
}
