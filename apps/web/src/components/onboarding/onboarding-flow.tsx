"use client";

import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { DevLogin } from "@/components/dev-login";
import { api, ApiError } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import {
  emptyDraft,
  toPayload,
  validateStep,
  type DraftErrors,
  type OnboardingDraft,
} from "@/lib/onboarding/draft";
import { estimateFromDraft } from "@/lib/onboarding/estimate";
import {
  CALCULATOR_KEY,
  draftFromCalculator,
  parseCalculator,
  parsePending,
  PENDING_KEY,
  stashPending,
} from "@/lib/onboarding/pending";
import { formatInt } from "@fitr8/domain/format";
import type { ProvidersDto } from "@fitr8/contracts";
import { PlanBuilding } from "./plan-building";
import { onboardingButton, OnboardingShell } from "./shell";
import { estimateLine, RAIL, SETUP_STEPS, type OnboardingMode } from "./steps-meta";
import { AboutStep, GoalStep, NameStep, TrainingStep } from "./steps";

type FormStep = "name" | "goal" | "about" | "training" | "signin";
const FORM: Record<OnboardingMode, FormStep[]> = {
  welcome: ["name", "goal", "about", "training", "signin"],
  new: ["goal", "about", "training"],
  edit: ["goal", "about", "training"],
};
const DRAFT_STEP: Partial<Record<FormStep, number>> = { goal: 1, about: 2, training: 3 };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The calculator handoff and unsaved answers live in sessionStorage, which the server can't see:
// read them as an external store so the first client render matches the server, then remount.
const noSubscribe = () => () => {};
function readStored(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The onboarding form for every entry point (docs/WEBSITE.md §3). */
export function OnboardingFlow(props: {
  mode: OnboardingMode;
  initial?: Partial<OnboardingDraft>;
  initialName?: string;
  providers?: ProvidersDto;
}) {
  const calculatorRaw = useSyncExternalStore(
    noSubscribe,
    () => (props.mode === "edit" ? null : readStored(CALCULATOR_KEY)),
    () => null,
  );
  // Answers whose save failed after sign-in come back here (signed-in, not onboarded).
  const pendingRaw = useSyncExternalStore(
    noSubscribe,
    () => (props.mode === "new" ? readStored(PENDING_KEY) : null),
    () => null,
  );
  const pending = parsePending(pendingRaw);
  return (
    <Flow
      key={`${calculatorRaw ?? ""}|${pendingRaw ?? ""}`}
      {...props}
      initial={pending ? { ...props.initial, ...pending.draft } : props.initial}
      calculatorRaw={calculatorRaw}
    />
  );
}

function Flow({
  mode,
  initial,
  initialName = "",
  providers,
  calculatorRaw,
}: {
  mode: OnboardingMode;
  initial?: Partial<OnboardingDraft>;
  initialName?: string;
  providers?: ProvidersDto;
  calculatorRaw: string | null;
}) {
  const router = useRouter();
  const steps = FORM[mode];
  const calc = parseCalculator(calculatorRaw);
  const fromCalc = calc ? draftFromCalculator(calc) : {};

  const [index, setIndex] = useState(0);
  const [reached, setReached] = useState(0);
  const [name, setName] = useState(initialName);
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
  const [errors, setErrors] = useState<DraftErrors & { name?: string }>({});
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

  function go(i: number) {
    setErrors({});
    setIndex(i);
    setReached((r) => Math.max(r, i));
    window.scrollTo({ top: 0 });
    if (steps[i] === "signin") stashPending({ name: name.trim(), draft });
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
    const found: DraftErrors & { name?: string } =
      step === "name"
        ? name.trim()
          ? {}
          : { name: "Tell us what to call you" }
        : validateStep(DRAFT_STEP[step] ?? 0, draft);
    if (Object.keys(found).length) {
      setErrors(found);
      requestAnimationFrame(() =>
        document
          .querySelector("[aria-invalid=true], [data-error]")
          ?.scrollIntoView({ block: "center" }),
      );
      return;
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
      await Promise.all([
        api("/api/onboarding", { method: "POST", json: toPayload(draft, timezone) }),
        wait(2600),
      ]);
      setBuilt(true);
      await wait(700);
      router.push(`/onboarding/plan?flow=${mode}`);
      router.refresh();
    } catch (e) {
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
  const stepNo = `Step ${index + 1} of ${steps.length}`;
  const greeting = name.trim() ? `, ${name.trim().split(" ")[0]}` : "";

  return (
    <OnboardingShell
      steps={RAIL[mode]}
      current={index}
      reached={reached}
      setupSteps={SETUP_STEPS[mode]}
      onStep={(i) => go(i)}
      estimate={
        est && {
          ...est,
          line: estimateLine({ ...est, targetDate: draft.targetDate }),
        }
      }
      railFooter={
        mode === "welcome" && (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-white underline underline-offset-4">
              Log in
            </Link>
          </>
        )
      }
      footer={
        <>
          {serverError && (
            <p role="alert" className="text-center text-[13px] font-semibold text-caution-text">
              {serverError}
            </p>
          )}
          {hasErrors && (
            <p role="alert" className="text-center text-[13px] text-ink-2">
              Check the highlighted fields above.
            </p>
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
            {step === "signin" ? (
              <p className="self-center text-[13px] text-ink-3">
                Continue with Google above to build your plan.
              </p>
            ) : (
              <button type="button" onClick={next} disabled={building} className={onboardingButton}>
                {index === steps.length - 1 ? "Build my plan" : "Continue"}
                <ArrowRight className="size-5" aria-hidden />
              </button>
            )}
          </div>
        </>
      }
    >
      {step === "name" && (
        <>
          <Heading
            kicker="Welcome to FITR8"
            title="First, what can we call you?"
            lead="Four quick questions and you’ll have daily calories, macros and a training week built for you."
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void next();
            }}
          >
            <NameStep
              name={name}
              setName={(v) => {
                setName(v);
                setErrors((e) => ({ ...e, name: undefined }));
              }}
              error={errors.name}
            />
          </form>
          <p className="text-sm text-ink-3 lg:hidden">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-fitr8">
              Log in
            </Link>
          </p>
        </>
      )}

      {step === "goal" && (
        <>
          <Heading
            kicker={mode === "edit" ? "Edit your plan" : stepNo}
            title={`What’s your goal${greeting}?`}
          />
          <GoalStep draft={draft} set={set} errors={errors} prefilled={prefilled} />
        </>
      )}

      {step === "about" && (
        <>
          <Heading kicker={mode === "edit" ? "Edit your plan" : stepNo} title="About you" />
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
          <AboutStep
            draft={draft}
            set={set}
            errors={errors}
            prefilled={prefilled}
            ageHint={ageHint}
          />
        </>
      )}

      {step === "training" && (
        <>
          <Heading kicker={mode === "edit" ? "Edit your plan" : stepNo} title="Food and training" />
          <TrainingStep draft={draft} set={set} errors={errors} />
        </>
      )}

      {step === "signin" && (
        <>
          <Heading
            kicker={stepNo}
            title="Save your plan"
            lead="Sign in so your plan, meals and progress are kept safe, and waiting for you in the app."
          />
          <SignInCard
            providers={providers ?? { google: true, dev: false }}
            kcal={est?.kcal ?? null}
            days={draft.trainingDaysPerWeek}
            where={draft.equipment}
          />
        </>
      )}

      {building && <PlanBuilding done={built} />}
    </OnboardingShell>
  );
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

const WHERE = { FULL_GYM: "the gym", DUMBBELLS: "home", BODYWEIGHT: "anywhere" } as const;

/** Step 5 (signed out): what gets saved, then Google. Answers are already stashed for /welcome/done. */
function SignInCard({
  providers,
  kcal,
  days,
  where,
}: {
  providers: ProvidersDto;
  kcal: number | null;
  days: number;
  where?: keyof typeof WHERE;
}) {
  const returnTo = "/welcome/done";
  return (
    <div className="flex flex-col gap-[18px] rounded-3xl bg-white p-6">
      <ul className="flex flex-col gap-2.5">
        {[
          <>
            Your daily target
            {kcal != null && (
              <>
                , about <b className="tabular-nums">{formatInt(kcal)} kcal</b>,
              </>
            )}{" "}
            with protein, carbs and fat
          </>,
          <>
            A {days}-day training week for {where ? WHERE[where] : "you"}
          </>,
          <>The same account on the web and on your phone</>,
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Check
              className="mt-1 size-[18px] shrink-0 text-protein"
              strokeWidth={2.6}
              aria-hidden
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {providers.google && (
        <a
          href={`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`}
          className={cn(
            onboardingButton,
            "bg-white text-fitr8-ink shadow-[inset_0_0_0_1px_var(--color-line-strong),6px_6px_0_var(--color-fitr8-deep)] hover:bg-white hover:shadow-[inset_0_0_0_1px_var(--color-line-strong),8px_8px_0_var(--color-fitr8-deep)]",
          )}
        >
          <GoogleMark />
          Continue with Google
        </a>
      )}
      {providers.dev && <DevLogin next={returnTo} />}
      <p className="text-center text-xs text-ink-3">
        We only use Google to sign you in. By continuing you agree to the Terms and Privacy Policy.
        FITR8 gives general fitness guidance, not medical advice.
      </p>
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
