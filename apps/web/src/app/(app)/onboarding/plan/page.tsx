import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StickyFooter } from "@/components/sticky-footer";
import { Button, ProgressSteps } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatInt } from "@fitlens/domain/format";
import { requireViewer, serverApiOrNull } from "@/lib/server/api";
import type { PlanDto } from "@fitlens/contracts";
import { TooFastPlan } from "./too-fast";

export const metadata = { title: "Your plan — FitLens" };

const dateLabel = (ymd: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ymd));

/** Screen 5: the plan computed at onboarding. Rebuilt from the database so a refresh still works. */
export default async function PlanPage() {
  const { profile } = await requireViewer();
  if (!profile?.onboardedAt) redirect("/onboarding");

  // 404 = no goal or target yet: send them back to finish onboarding.
  const data = await serverApiOrNull<PlanDto>("/plan");
  if (!data) redirect("/onboarding");
  const { summary, metric, goal, training } = data;
  const { kcal, proteinG, carbsG, fatG } = summary.target;
  const macroKcal = { p: proteinG * 4, c: carbsG * 4, f: fatG * 9 };
  const macroTotal = macroKcal.p + macroKcal.c + macroKcal.f || 1;
  const adjustment = kcal - summary.plan.tdee;
  const recomp = goal.type === "RECOMPOSITION";
  const weekly = summary.plan.weeklyChangeKg;

  const targetCard = (
    <section className="rounded-card bg-ink p-5 text-white" aria-label="Daily target">
      <p className="text-[13px] font-semibold text-white/70">Daily target</p>
      <p className="display text-[40px] leading-none tabular-nums">
        {formatInt(kcal)} <span className="text-[15px] font-semibold text-white/70">kcal</span>
      </p>
      <p className="mt-1.5 text-[13px] text-white/70 tabular-nums">
        Maintenance {formatInt(summary.plan.tdee)} kcal
        {Math.abs(adjustment) >= 10 &&
          ` ${adjustment < 0 ? "−" : "+"} ${formatInt(Math.abs(adjustment))} kcal ${adjustment < 0 ? "deficit" : "surplus"}`}
      </p>
      <div
        className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`Split: protein ${Math.round((macroKcal.p / macroTotal) * 100)}%, carbs ${Math.round((macroKcal.c / macroTotal) * 100)}%, fat ${Math.round((macroKcal.f / macroTotal) * 100)}% of calories`}
      >
        <span className="bg-[#5fae88]" style={{ width: `${(macroKcal.p / macroTotal) * 100}%` }} />
        <span className="bg-carbs" style={{ width: `${(macroKcal.c / macroTotal) * 100}%` }} />
        <span className="bg-[#9d84d6]" style={{ width: `${(macroKcal.f / macroTotal) * 100}%` }} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
        <Macro label="Protein" grams={proteinG} dot="bg-[#5fae88]" />
        <Macro label="Carbs" grams={carbsG} dot="bg-carbs" />
        <Macro label="Fat" grams={fatG} dot="bg-[#9d84d6]" />
      </dl>
    </section>
  );

  if (!summary.plan.feasible && !recomp) {
    return (
      <TooFastPlan
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
    <main className="flex flex-1 flex-col px-6 pt-4">
      <div className="flex h-11 items-center">
        <ProgressSteps current={4} total={4} className="flex-1" />
      </div>
      <h1 className="mt-6 display text-[28px] leading-tight">Your plan</h1>

      <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-protein-soft px-3 py-1 text-[13px] font-semibold text-protein">
        <CircleCheck className="size-4" aria-hidden />
        Realistic goal
      </p>

      <section className="mt-5 rounded-card bg-surface p-4" aria-label="Now and goal">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[12px] font-semibold text-ink-3">Now</p>
            <p className="display text-[26px] tabular-nums">
              {metric.weightKg} <span className="text-[15px] font-semibold text-ink-3">kg</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold text-ink-3">
              Goal ·{" "}
              {dateLabel(
                summary.plan.feasible
                  ? goal.targetDate
                  : (summary.plan.suggestedTargetDate ?? goal.targetDate),
              )}
            </p>
            <p className="display text-[26px] tabular-nums">
              {recomp ? "Hold" : summary.plan.targetWeightKg}{" "}
              <span className="text-[15px] font-semibold text-ink-3">
                {recomp ? "weight" : "kg"}
              </span>
            </p>
          </div>
        </div>
        <ProjectionLine
          from={metric.weightKg}
          to={recomp ? metric.weightKg : summary.plan.targetWeightKg}
        />
        <p className="text-[13px] text-ink-2">
          {recomp
            ? "Weight stays steady while you lose fat and build muscle."
            : `${weekly > 0 ? "+" : weekly < 0 ? "−" : ""}${Math.abs(weekly)} kg a week`}
          {goal.targetBodyFatPct != null &&
            ` · body fat ${summary.bodyFatPct ?? "?"}% → ${goal.targetBodyFatPct}%`}
        </p>
      </section>

      <div className="mt-3">{targetCard}</div>

      <section className="mt-3 grid grid-cols-3 gap-2" aria-label="Your numbers">
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
        <ul className="mt-4 flex flex-col gap-1.5 text-[13px] text-ink-2">
          {summary.plan.warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <StickyFooter className="pt-8">
        <Button asChild>
          <Link href="/today">Start my plan</Link>
        </Button>
      </StickyFooter>
    </main>
  );
}

function Macro({ label, grams, dot }: { label: string; grams: number; dot: string }) {
  return (
    <div className="flex flex-col">
      <dt className="flex items-center gap-1.5 text-white/70">
        <span aria-hidden className={cn("size-2 rounded-full", dot)} />
        {label}
      </dt>
      <dd className="text-base font-bold tabular-nums">{grams} g</dd>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col rounded-card bg-surface p-3">
      <span className="text-[12px] font-semibold text-ink-3">{label}</span>
      <span className="display text-[22px] tabular-nums">{value}</span>
      <span className="text-[12px] text-ink-3">{sub}</span>
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
    <svg viewBox={`0 0 ${w} ${h}`} className="my-3 h-auto w-full" aria-hidden>
      <line x1={pad} y1={y1} x2={w - pad} y2={y2} className="stroke-line" strokeWidth={2} />
      <line
        x1={pad}
        y1={y1}
        x2={w - pad}
        y2={y2}
        className="stroke-brand"
        strokeWidth={2.5}
        strokeDasharray="6 6"
        strokeLinecap="round"
      />
      <circle cx={pad} cy={y1} r={5} className="fill-ink" />
      <circle cx={w - pad} cy={y2} r={5} className="fill-brand" />
    </svg>
  );
}
