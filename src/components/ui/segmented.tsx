"use client";

import { cn } from "@/lib/cn";

export interface SegmentedProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  className?: string;
}

/** Sunken track; the selected option is a raised surface. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex rounded-input bg-chip p-1", className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 flex-1 rounded-[11px] px-3 text-[15px] font-semibold transition-colors duration-150",
              selected ? "bg-surface text-ink shadow-seg" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
