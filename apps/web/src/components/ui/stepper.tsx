"use client";

import { Minus, Plus } from "lucide-react";
import { formatQty } from "@fitlens/domain/format";

/** −/+ stepper with 44 px buttons on a sunken track. */
export function Stepper({
  value,
  step,
  min = step,
  max = Infinity,
  onChange,
  label,
}: {
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const round = (n: number) => Math.round(n * 100) / 100;
  return (
    <div className="flex items-center rounded-input bg-sunken" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Less ${label}`}
        disabled={value - step < min - 1e-9}
        onClick={() => onChange(round(value - step))}
        className="grid size-11 place-items-center rounded-input text-ink disabled:text-ink-3/50"
      >
        <Minus className="size-5" strokeWidth={2} />
      </button>
      <span
        className="min-w-8 text-center text-[15px] font-semibold tabular-nums"
        aria-live="polite"
      >
        {formatQty(value)}
      </span>
      <button
        type="button"
        aria-label={`More ${label}`}
        disabled={value + step > max + 1e-9}
        onClick={() => onChange(round(value + step))}
        className="grid size-11 place-items-center rounded-input text-ink disabled:text-ink-3/50"
      >
        <Plus className="size-5" strokeWidth={2} />
      </button>
    </div>
  );
}
