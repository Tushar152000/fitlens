import { ArrowRight, CircleCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { onboardingButton } from "@/components/onboarding/button-styles";
import { OnboardingShell, type ShellEstimate } from "@/components/onboarding/shell";
import {
  dateLabel,
  estimateLine,
  parseMode,
  RAIL,
  SETUP_STEPS,
} from "@/components/onboarding/steps-meta";
import { cn } from "@/lib/cn";
import { formatInt } from "@fitr8/domain/format";
import { requireViewer, serverApiOrNull } from "@/lib/server/api";
import type { PlanDto } from "@fitr8/contracts";
import { TooFastPlan } from "./too-fast";

export const metadata = { title: "Your plan — FITR8" };

/**
 * Screen 5 / 5b: the plan computed at onboarding, rebuilt from the database so a refresh still
 * works. `?flow=welcome|new` continues to Get the app; editing a goal goes back to /home.
 */
export default async function PlanPage({ searchParams }: PageProps<"/onboarding/plan">) {
  const [{ profile }, sp] = await Promise.all([requireViewer(), searchParams]);
  if (!profile?.onboardedAt) redirect("/onboarding");

  // 404 = no goal or target yet: send them back to finish onboarding.
  const data = await serverApiOrNull<PlanDto>("/plan");
  if (!data) redirect("/onboarding");

  const mode = parseMode(sp.flow);
  const next = mode === "edit" ? "/home" : `/onboarding/app?flow=${mode}`;
  const { summary, metric, goal, training } = data;
  const { kcal, proteinG, carbsG, fatG } = summary.target;
  const recomp = goal.type === "RECOMPOSITION";
  const weekly = summary.plan.weeklyChangeKg;
  const rail = RAIL[mode];
  const shell = {
    steps: rail,
    current: rail.indexOf("Your daily target"),
    setupSteps: SETUP_STEPS[mode],
    estimate: {
      kcal,
      proteinG,
      carbsG,
      fatG,
      exact: true,
      line: estimateLine({
        goalType: goal.type,
        exact: true,
        targetWeightKg: summary.plan.targetWeightKg,
        targetDate: goal.targetDate,
      }),
    } satisfies ShellEstimate,
    wide: true,
  };

  const targetCard = <TargetCard plan={data} />;

  if (!summary.plan.feasible && !recomp) {
    return (
      <TooFastPlan
        shell={shell}
        next={next}
        losing={goal.type === "FAT_LOSS"}
        neededWeeklyKg={summary.plan.neededWeeklyChangeKg}
        safeWeeklyKg={summary.plan.weeklyChangeKg}
        targetWeightKg={summary.plan.targetWeightKg}
        targetDate={goal.targetDate}
        suggestedDate={summary.plan.suggestedTargetDate ?? null}
        closerTargetKg={summary.plan.closerTargetWeightKg ?? null}
        targetCard={targetCard}
      />
    );
  }

  return (
    <OnboardingShell
      {...shell}
      footer={
        <Link href={next} className={onboardingButton}>
          {mode === "edit" ? "Save my plan" : "Start my plan"}
          <ArrowRight className="size-5" aria-hidden />
        </Link>
      }
    >
      <div>
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-protein-soft px-3 py-1 text-[13px] font-bold text-protein">
          <CircleCheck className="size-4" aria-hidden />
          Realistic goal
        </p>
        <h1 className="mt-3 text-[30px] leading-[1.12] font-semibold tracking-[-0.025em] lg:text-[38px]">
          Your plan
        </h1>
        <p className="mt-2 text-ink-2">
          Built from your answers with safe-pace rules. It adjusts every week from your real trend.
        </p>
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {targetCard}
        <div className="flex flex-col gap-3.5">
          <section className="rounded-[20px] bg-white p-[18px]" aria-label="Now and goal">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold text-ink-3">Now</p>
                <p className="text-[26px] font-semibold tracking-[-0.02em] tabular-nums">
                  {metric.weightKg} <span className="text-sm text-ink-3">kg</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-ink-3">
                  Goal · {dateLabel(goal.targetDate)}
                </p>
                <p className="text-[26px] font-semibold tracking-[-0.02em] tabular-nums">
                  {recomp ? "Hold" : summary.plan.targetWeightKg}{" "}
                  <span className="text-sm text-ink-3">{recomp ? "weight" : "kg"}</span>
                </p>
              </div>
            </div>
            <ProjectionLine
              from={metric.weightKg}
              to={recomp ? metric.weightKg : summary.plan.targetWeightKg}
            />
            <p className="text-sm text-ink-2 tabular-nums">
              {recomp
                ? "Weight stays steady while you lose fat and build muscle."
                : `${weekly > 0 ? "+" : weekly < 0 ? "−" : ""}${Math.abs(weekly)} kg a week`}
              {goal.targetBodyFatPct != null &&
                ` · body fat ${summary.bodyFatPct ?? "?"}% → ${goal.targetBodyFatPct}%`}
            </p>
          </section>
          <section className="grid grid-cols-3 gap-2.5" aria-label="Your numbers">
            <Tile
              label="BMI"
              value={String(summary.bmi.value)}
              sub={summary.bmi.category.charAt(0).toUpperCase() + summary.bmi.category.slice(1)}
            />
            <Tile label="BMR" value={formatInt(summary.plan.bmr)} sub="kcal at rest" />
            <Tile
              label="Workouts"
              value={`${training.daysPerWeek}×`}
              sub={`a week, ${training.sessionMinutes} min`}
            />
          </section>
          {summary.plan.warnings.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-[13px] text-ink-2">
              {summary.plan.warnings.map((w) => (
                <li key={w} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </OnboardingShell>
  );
}

/** Dark daily-target card with the "explain every change" line and the macro split. */
function TargetCard({ plan }: { plan: PlanDto }) {
  const { summary } = plan;
  const { kcal, proteinG, carbsG, fatG } = summary.target;
  const k = { p: proteinG * 4, c: carbsG * 4, f: fatG * 9 };
  const total = k.p + k.c + k.f || 1;
  const adjustment = kcal - summary.plan.tdee;
  return (
    <section
      className="rounded-3xl bg-fitr8-ink p-[22px] text-white shadow-[6px_6px_0_var(--color-fitr8-deep)]"
      aria-label="Daily target"
    >
      <p className="text-[13px] font-semibold text-white/70">Daily target</p>
      <p className="mt-1.5 text-[56px] leading-none font-semibold tracking-[-0.035em] tabular-nums lg:text-[60px]">
        {formatInt(kcal)} <span className="text-base tracking-normal text-white/70">kcal</span>
      </p>
      <p className="mt-2 text-sm text-white/75 tabular-nums">
        Maintenance {formatInt(summary.plan.tdee)} kcal
        {Math.abs(adjustment) >= 10 &&
          ` ${adjustment < 0 ? "−" : "+"} ${formatInt(Math.abs(adjustment))} kcal ${adjustment < 0 ? "deficit" : "surplus"}`}
      </p>
      <div
        className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`Split: protein ${Math.round((k.p / total) * 100)}%, carbs ${Math.round((k.c / total) * 100)}%, fat ${Math.round((k.f / total) * 100)}% of calories`}
      >
        <span className="bg-[#5fae88]" style={{ width: `${(k.p / total) * 100}%` }} />
        <span className="bg-carbs" style={{ width: `${(k.c / total) * 100}%` }} />
        <span className="bg-[#9d84d6]" style={{ width: `${(k.f / total) * 100}%` }} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
        <Macro label="Protein" grams={proteinG} dot="bg-[#5fae88]" />
        <Macro label="Carbs" grams={carbsG} dot="bg-carbs" />
        <Macro label="Fat" grams={fatG} dot="bg-[#9d84d6]" />
      </dl>
    </section>
  );
}

function Macro({ label, grams, dot }: { label: string; grams: number; dot: string }) {
  return (
    <div className="flex flex-col">
      <dt className="flex items-center gap-1.5 text-white/70">
        <span aria-hidden className={cn("size-2 rounded-full", dot)} />
        {label}
      </dt>
      <dd className="text-[17px] font-semibold tabular-nums">{grams} g</dd>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col rounded-2xl bg-white p-3">
      <span className="text-xs font-semibold text-ink-3">{label}</span>
      <span className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums">{value}</span>
      <span className="text-xs text-ink-3">{sub}</span>
    </div>
  );
}

/** Straight-line projection from now to goal. Decorative; the numbers above carry the meaning. */
function ProjectionLine({ from, to }: { from: number; to: number }) {
  const w = 300;
  const h = 64;
  const pad = 8;
  const flat = Math.abs(from - to) < 0.1;
  const y1 = flat ? h / 2 : from > to ? pad : h - pad;
  const y2 = flat ? h / 2 : from > to ? h - pad : pad;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="my-3 h-16 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line x1={pad} y1={y1} x2={w - pad} y2={y2} className="stroke-line" strokeWidth={2} />
      <line
        x1={pad}
        y1={y1}
        x2={w - pad}
        y2={y2}
        className="stroke-fitr8"
        strokeWidth={2.5}
        strokeDasharray="6 6"
        strokeLinecap="round"
      />
      <circle cx={pad} cy={y1} r={5} className="fill-fitr8-ink" />
      <circle cx={w - pad} cy={y2} r={5} className="fill-fitr8" />
    </svg>
  );
}
