import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Protein-soft card explaining a change: bold headline + one-line reason with the numbers. */
export function InsightCard({
  headline,
  reason,
  className,
}: {
  headline: ReactNode;
  reason: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3 rounded-card bg-protein-soft p-4", className)}>
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-protein text-white">
        <Check className="size-4" strokeWidth={2.5} aria-hidden />
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-[15px] font-bold">{headline}</p>
        <p className="text-[13px] text-ink-2">{reason}</p>
      </div>
    </div>
  );
}
