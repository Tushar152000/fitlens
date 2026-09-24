"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TileOption<T extends string | number> {
  value: T;
  label: string;
  sub?: string;
  icon?: ReactNode;
}

/** Row of equal radio tiles ("By when?", "Where I train"). Selected = 2 px brand border. */
export function TileGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: TileOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
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
              "flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-input bg-surface px-2 py-3 text-center transition-colors duration-150",
              selected
                ? "border-2 border-brand px-[7px] py-[11px]"
                : "border border-line-strong hover:border-ink-3",
            )}
          >
            {o.icon && <span className={selected ? "text-brand" : "text-ink-2"}>{o.icon}</span>}
            <span className="text-[15px] font-semibold">{o.label}</span>
            {o.sub && (
              <span className="text-[12px] font-medium text-ink-3 tabular-nums">{o.sub}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
