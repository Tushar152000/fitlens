import { cn } from "@/lib/cn";
import { formatInt } from "@fitr8/domain/format";

export type Macro = "protein" | "carbs" | "fat";

const FILL: Record<Macro, string> = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
};

const LABEL: Record<Macro, string> = { protein: "Protein", carbs: "Carbs", fat: "Fat" };

/** Label + "74 / 148 g" row over an 8 px bar. The text value is always shown. */
export function MacroBar({
  macro,
  eaten,
  target,
  className,
}: {
  macro: Macro;
  eaten: number;
  target: number;
  className?: string;
}) {
  const pct = target > 0 ? Math.min(100, (eaten / target) * 100) : 0;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-semibold">{LABEL[macro]}</span>
        <span className="font-semibold text-ink-2 tabular-nums">
          {formatInt(eaten)} / {formatInt(target)} g
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-track"
        role="meter"
        aria-label={`${LABEL[macro]}: ${formatInt(eaten)} of ${formatInt(target)} grams`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.round(eaten)}
      >
        <div
          className={cn(
            "h-full animate-bar-in rounded-full transition-[width] duration-200 ease-out",
            // Over target fills ink, never red (design 6c).
            eaten > target && target > 0 ? "bg-ink" : FILL[macro],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
