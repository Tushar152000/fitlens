"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { track } from "@/lib/client/analytics";
import { stashCalculator } from "@/lib/onboarding/pending";
import { formatInt } from "@fitr8/domain/format";
import {
  previewTarget,
  type ActivityLevel,
  type GoalType,
  type Sex,
} from "@fitr8/domain/nutrition";
import { ctaArrow, hardButton } from "./cta";
import { SectionHead } from "./section-head";
import { useCountUp } from "./use-count-up";

const GOALS: { value: GoalType; label: string }[] = [
  { value: "FAT_LOSS", label: "Lose fat" },
  { value: "MUSCLE_GAIN", label: "Build muscle" },
  { value: "RECOMPOSITION", label: "Recomposition" },
];
const SEXES: { value: Sex; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];
const ACTIVITY: { value: ActivityLevel; label: string }[] = [
  { value: "SEDENTARY", label: "Mostly sitting" },
  { value: "LIGHT", label: "Lightly active" },
  { value: "MODERATE", label: "Moderately active" },
  { value: "VERY_ACTIVE", label: "Very active" },
  { value: "ATHLETE", label: "Athlete" },
];

const parse = (v: string) => parseFloat(v.replace(",", "."));

function validate(age: number, height: number, weight: number) {
  if (!(age >= 13 && age <= 100)) return "Enter an age between 13 and 100.";
  if (!(height >= 120 && height <= 230)) return "Enter a height between 120 and 230 cm.";
  if (!(weight >= 30 && weight <= 250)) return "Enter a weight between 30 and 250 kg.";
  return null;
}

/**
 * Signed-out "see your daily target". Numbers come from previewTarget (@fitr8/domain), the same
 * rules onboarding uses; nothing is sent anywhere.
 */
export function TargetCalculator() {
  const [goal, setGoal] = useState<GoalType>("FAT_LOSS");
  const [sex, setSex] = useState<Sex>("MALE");
  const [age, setAge] = useState("29");
  const [height, setHeight] = useState("176");
  const [weight, setWeight] = useState("82");
  const [activity, setActivity] = useState<ActivityLevel>("LIGHT");
  // Keep showing the last valid result while a field is mid-edit.
  const [last, setLast] = useState(() =>
    previewTarget(
      { sex: "MALE", ageYears: 29, heightCm: 176, weightKg: 82, activityLevel: "LIGHT" },
      "FAT_LOSS",
    ),
  );

  const nums = { age: parse(age), height: parse(height), weight: parse(weight) };
  const error = validate(nums.age, nums.height, nums.weight);
  const result = error
    ? last
    : previewTarget(
        {
          sex,
          ageYears: nums.age,
          heightCm: nums.height,
          weightKg: nums.weight,
          activityLevel: activity,
        },
        goal,
      );
  if (!error && result.kcal !== last.kcal) setLast(result);

  const kcal = useCountUp(result.kcal);
  const macroKcal = result.proteinG * 4 + result.carbsG * 4 + result.fatG * 9;
  const adj = result.dailyAdjustmentKcal;
  const pace = result.weeklyChangeKg;

  let why: React.ReactNode;
  if (result.noAdjustment) {
    why = (
      <>
        <b className="text-white">{formatInt(result.tdee)} maintenance.</b> Under 18s get no deficit
        or surplus, only healthy habits.
      </>
    );
  } else {
    const change = `${formatInt(result.tdee)} maintenance ${adj < 0 ? "−" : "+"} ${formatInt(Math.abs(adj))}`;
    why =
      goal === "RECOMPOSITION" ? (
        <>
          <b className="text-white">{change}</b>, a light 5% deficit while you build strength.
        </>
      ) : (
        <>
          <b className="text-white">{change}</b> for about {Math.abs(pace).toFixed(1)} kg a week{" "}
          {pace < 0 ? "down" : "up"}.{result.raisedToFloor ? " Raised to the safe minimum." : ""}
        </>
      );
  }

  return (
    <section id="numbers" aria-labelledby="numbers-heading" className="scroll-mt-16 py-16 sm:py-28">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-10">
        <SectionHead
          id="numbers-heading"
          kicker="Your numbers"
          title="See your daily target before you sign up"
          aside="The same safe-pace rules the app uses. Change anything and the numbers update as you type."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={(e) => e.preventDefault()}
            noValidate
            className="grid content-start gap-x-4 gap-y-[18px] rounded-[28px] bg-white p-5 sm:grid-cols-2 sm:p-8"
          >
            <Segmented label="Your goal" options={GOALS} value={goal} onChange={setGoal} />
            <Segmented label="Sex" options={SEXES} value={sex} onChange={setSex} />
            <Field
              id="calc-age"
              label="Age"
              unit="yrs"
              value={age}
              onChange={setAge}
              inputMode="numeric"
            />
            <Field id="calc-height" label="Height" unit="cm" value={height} onChange={setHeight} />
            <Field id="calc-weight" label="Weight" unit="kg" value={weight} onChange={setWeight} />
            <div className="flex min-w-0 flex-col gap-[7px]">
              <label htmlFor="calc-activity" className="text-[13px] font-semibold text-ink-2">
                Activity
              </label>
              <div className="flex h-[52px] items-center rounded-input border border-line-strong px-3.5 focus-within:border-fitr8 focus-within:ring-3 focus-within:ring-fitr8-lilac-soft">
                <select
                  id="calc-activity"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value as ActivityLevel)}
                  className="min-w-0 flex-1 cursor-pointer bg-transparent font-semibold outline-none"
                >
                  {ACTIVITY.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm font-semibold text-caution-text sm:col-span-2">
                {error}
              </p>
            )}
          </form>

          <div
            aria-live="polite"
            className="flex flex-col gap-[22px] rounded-[28px] bg-fitr8-ink p-5 text-white shadow-[10px_10px_0_var(--color-fitr8)] sm:p-8"
          >
            <div>
              <p className="text-[13px] font-semibold tracking-[0.06em] text-white/65 uppercase">
                Your daily target
              </p>
              <p className="text-[56px] leading-none font-semibold tracking-[-0.03em] tabular-nums sm:text-[84px]">
                {formatInt(kcal)}{" "}
                <span className="text-lg font-semibold tracking-normal text-white/70">kcal</span>
              </p>
              <p className="mt-2 text-[15px] text-white/80">{why}</p>
            </div>
            <div className="flex flex-col gap-3">
              {(
                [
                  ["Protein", result.proteinG, 4, "bg-[#5fb38a]"],
                  ["Carbs", result.carbsG, 4, "bg-carbs"],
                  ["Fat", result.fatG, 9, "bg-[#e0679a]"],
                ] as const
              ).map(([label, g, perG, fill]) => (
                <div
                  key={label}
                  className="grid grid-cols-[70px_minmax(0,1fr)_64px] items-center gap-3 text-sm font-semibold"
                >
                  <span>{label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-white/12">
                    <i
                      className={`block h-full rounded-full transition-[width] duration-400 ${fill}`}
                      style={{ width: `${((g * perG) / macroKcal) * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums">{g} g</span>
                </div>
              ))}
            </div>
            <dl className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3">
              {(
                [
                  ["BMR", formatInt(result.bmr)],
                  ["Maintenance", formatInt(result.tdee)],
                  ["Water", `${(result.waterMl / 1000).toFixed(1)} L`],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex flex-col-reverse rounded-[14px] bg-white/7 p-3">
                  <dd className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums">
                    {value}
                  </dd>
                  <dt className="text-xs font-semibold text-white/65">{label}</dt>
                </div>
              ))}
            </dl>
            <Link
              href="/welcome"
              onClick={() => {
                track("calculator_used", {});
                // Onboarding prefills from these (sessionStorage, this tab only).
                if (!error)
                  stashCalculator({
                    goal,
                    sex,
                    ageYears: nums.age,
                    heightCm: nums.height,
                    weightKg: nums.weight,
                    activity,
                  });
              }}
              className={`${hardButton} mt-auto self-start bg-white text-fitr8`}
            >
              Start with these numbers
              <ArrowRight className={ctaArrow} aria-hidden />
            </Link>
            <p className="text-[13px] text-white/60">
              General fitness guidance, not medical advice. Under 18, pregnant or managing a
              condition? FITR8 won’t set a deficit for you.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const labelId = `seg-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex flex-col gap-[7px] sm:col-span-2">
      <span id={labelId} className="text-[13px] font-semibold text-ink-2">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex gap-1 rounded-input bg-chip p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 flex-1 rounded-[11px] px-2 text-[15px] font-semibold transition-colors",
              o.value === value
                ? "bg-white text-fitr8-ink shadow-seg"
                : "text-ink-2 hover:text-fitr8-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  unit,
  value,
  onChange,
  inputMode = "decimal",
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[7px]">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      <div className="flex h-[52px] items-center rounded-input border border-line-strong px-3.5 focus-within:border-fitr8 focus-within:ring-3 focus-within:ring-fitr8-lilac-soft">
        <input
          id={id}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold tabular-nums outline-none"
        />
        <span className="font-semibold text-ink-3">{unit}</span>
      </div>
    </div>
  );
}
