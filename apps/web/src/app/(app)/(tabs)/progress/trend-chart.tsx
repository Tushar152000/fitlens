import type { ProgressDto } from "@fitlens/contracts";

const W = 320;
const H = 170;
const PAD = { top: 12, right: 12, bottom: 24, left: 34 };
const DAY = 86_400_000;

const t = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getTime();
const short = (ms: number) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(ms);

/** You (7-day average, solid) vs plan (dashed straight line). Raw weigh-ins are faint dots. */
export function TrendChart({
  points,
  plan,
}: {
  points: ProgressDto["points"];
  plan: ProgressDto["plan"];
}) {
  const start = t(plan.startDate);
  const end = t(plan.targetDate);
  const planAt = (ms: number) =>
    plan.startWeightKg +
    ((plan.targetWeightKg - plan.startWeightKg) * (ms - start)) / Math.max(DAY, end - start);

  // Window: from the first data point (or goal start) to at least 4 weeks later, capped at the target date.
  const x0 = Math.min(start, points.length ? t(points[0].date) : start);
  const lastData = points.length ? t(points.at(-1)!.date) : x0;
  const x1 = Math.max(lastData + 7 * DAY, Math.min(end, x0 + 28 * DAY));

  const weights = [...points.flatMap((p) => [p.weightKg, p.avg7]), planAt(x0), planAt(x1)];
  let lo = Math.min(...weights);
  let hi = Math.max(...weights);
  if (hi - lo < 2) {
    const mid = (hi + lo) / 2;
    lo = mid - 1;
    hi = mid + 1;
  }
  lo = Math.floor(lo - 0.3);
  hi = Math.ceil(hi + 0.3);

  const x = (ms: number) => PAD.left + ((ms - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const y = (kg: number) => PAD.top + ((hi - kg) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const ticks = [lo, (lo + hi) / 2, hi];
  const you = points.map((p) => `${x(t(p.date)).toFixed(1)},${y(p.avg7).toFixed(1)}`).join(" ");
  const latest = points.at(-1);

  const label = latest
    ? `Weight trend: 7-day average ${latest.avg7} kg on ${short(t(latest.date))}; plan for that day ${planAt(t(latest.date)).toFixed(1)} kg. Goal ${plan.targetWeightKg} kg by ${short(end)}.`
    : "No weigh-ins yet.";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {ticks.map((kg) => (
        <g key={kg}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(kg)}
            y2={y(kg)}
            className="stroke-line"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 6}
            y={y(kg) + 4}
            textAnchor="end"
            className="fill-ink-3 text-[10px] font-semibold tabular-nums"
          >
            {Number.isInteger(kg) ? kg : kg.toFixed(1)}
          </text>
        </g>
      ))}
      <text x={PAD.left} y={H - 6} className="fill-ink-3 text-[10px] font-semibold">
        {short(x0)}
      </text>
      <text
        x={W - PAD.right}
        y={H - 6}
        textAnchor="end"
        className="fill-ink-3 text-[10px] font-semibold"
      >
        {short(x1)}
      </text>

      <line
        x1={x(x0)}
        y1={y(planAt(x0))}
        x2={x(x1)}
        y2={y(planAt(x1))}
        className="stroke-ink-3"
        strokeWidth={1.75}
        strokeDasharray="5 5"
      />

      {points.map((p) => (
        <circle
          key={p.date}
          cx={x(t(p.date))}
          cy={y(p.weightKg)}
          r={2.5}
          className="fill-brand/30"
        />
      ))}
      {points.length > 1 && (
        <polyline
          points={you}
          fill="none"
          className="stroke-brand"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {latest && (
        <circle
          cx={x(t(latest.date))}
          cy={y(latest.avg7)}
          r={4.5}
          className="fill-brand stroke-surface"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}
