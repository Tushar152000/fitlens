import { cn } from "@/lib/cn";

/** Segmented step indicator with an "N of M" label. `current` is 1-based. */
export function ProgressSteps({
  current,
  total = 4,
  className,
}: {
  current: number;
  total?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={`Step ${current} of ${total}`}
        className="flex flex-1 gap-1.5"
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-200",
              i < current ? "bg-ink" : "bg-line",
            )}
          />
        ))}
      </div>
      <span className="text-[13px] font-semibold text-ink-3 tabular-nums">
        {current} of {total}
      </span>
    </div>
  );
}
