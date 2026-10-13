import { formatInt } from "@fitr8/domain/format";

const R = 68;
const STROKE = 14;
const SIZE = R * 2 + STROKE;
const CIRC = 2 * Math.PI * R;

/**
 * Calories ring: brand arc for eaten, centre shows what's left ("kcal to go" before anything is
 * logged); the arc draws in on mount. Over target the ring completes in ink with a grey arc for the overflow — never red.
 */
export function CalorieRing({
  eaten,
  target,
  size = 172,
}: {
  eaten: number;
  target: number;
  size?: number;
}) {
  const left = Math.round(target - eaten);
  const over = left < 0;
  const fraction = target > 0 ? Math.min(1, Math.max(0, eaten / target)) : 0;
  const overflow = over && target > 0 ? Math.min(1, -left / target) : 0;
  const empty = eaten <= 0;
  const label = over
    ? `${formatInt(-left)} kcal over target of ${formatInt(target)}`
    : `${formatInt(left)} of ${formatInt(target)} kcal left`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-full -rotate-90"
        role="img"
        aria-label={label}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-track"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - fraction)}
          style={{ "--ring-circ": CIRC } as React.CSSProperties}
          className={`animate-ring-in transition-[stroke-dashoffset] duration-200 ease-out ${over ? "stroke-ink" : "stroke-brand"}`}
        />
        {over && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE - 6}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - overflow)}
            style={{ "--ring-circ": CIRC, animationDelay: "500ms" } as React.CSSProperties}
            className="animate-ring-in stroke-line-strong transition-[stroke-dashoffset] duration-200 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="display text-[32px] leading-none tabular-nums">
          {formatInt(Math.abs(left))}
        </span>
        <span className="mt-1 text-[13px] font-semibold text-ink-3">
          {over ? "kcal over" : empty ? "kcal to go" : "kcal left"}
        </span>
      </div>
    </div>
  );
}
