import { InsightCard } from "@/components/ui";
import { formatInt } from "@fitlens/domain/format";
import { requireOnboardedViewer, serverApi } from "@/lib/server/api";
import type { ProgressDto } from "@fitlens/contracts";
import { CheckinForm } from "./checkin-form";
import { TrendChart } from "./trend-chart";

export const metadata = { title: "Progress — FitLens" };

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)} kg`;

/** Headline + one-line reason for the week, with the numbers behind it. Targets change only via recompute. */
function insight(p: ProgressDto) {
  const kcal = p.target ? `${formatInt(p.target.kcal)} kcal` : "your target";
  if (p.weeklyChange == null) {
    return {
      headline: `Targets stay at ${kcal}`,
      reason:
        p.points.length < 2
          ? "Weigh in once a week, same time of day. After two weekly check-ins we can compare your trend with the plan."
          : "Log a weigh-in this week and last week so we can compare your weekly trend with the plan.",
    };
  }
  const planned = p.plan.weeklyChangeKg;
  const actual = p.weeklyChange;
  const diff = actual - planned;
  const onTrack = Math.abs(diff) <= 0.25;
  return {
    headline: onTrack ? `On track — targets stay at ${kcal}` : `Targets stay at ${kcal} for now`,
    reason: `${signed(actual)} this week vs ${signed(planned)} planned (7-day averages).${
      onTrack
        ? ""
        : " One week is noisy — we'll look at the next check-in before changing anything."
    }`,
  };
}

/** Screen 10: weekly check-in, trend vs plan, last-7-day stats. */
export default async function ProgressPage() {
  await requireOnboardedViewer();
  const p = await serverApi<ProgressDto>("/progress");
  const { headline, reason } = insight(p);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[13px] font-semibold text-ink-3">Weekly check-in</p>
        <h1 className="display text-[28px] leading-tight">Progress</h1>
      </header>

      <CheckinForm
        lastWeightKg={p.latest?.weightKg ?? null}
        lastWaistCm={p.latest?.waistCm ?? null}
      />

      <InsightCard headline={headline} reason={reason} />

      <section
        className="flex flex-col gap-3 rounded-card bg-surface p-4"
        aria-labelledby="trend-heading"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="trend-heading" className="display text-[19px]">
            Weight trend
          </h2>
          <p className="flex items-center gap-3 text-[12px] font-semibold text-ink-3">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4 rounded-full bg-brand" /> You
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-0 w-4 border-t-2 border-dashed border-ink-3" /> Plan
            </span>
          </p>
        </div>
        <TrendChart points={p.points} plan={p.plan} />
      </section>

      <section className="grid grid-cols-3 gap-2" aria-label="Last 7 days">
        <Tile
          label="Avg intake"
          value={p.avgIntake == null ? "—" : formatInt(p.avgIntake)}
          sub={p.avgIntake == null ? "no meals yet" : "kcal a day"}
        />
        <Tile label="Days logged" value={`${p.daysLogged}/7`} sub="last 7 days" />
        <Tile label="Workouts" value="—" sub="tracking soon" />
      </section>
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
