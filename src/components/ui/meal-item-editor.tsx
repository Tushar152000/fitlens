"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatInt, formatPortion, sentenceCase, unitStep } from "@/lib/format";
import { Stepper } from "./stepper";

export const LOW_CONFIDENCE = 0.6;

export interface EditableItem {
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  kcal: number;
  confidence?: number | null;
  approximate?: boolean;
}

/** One detected item: name, portion, low-confidence flag, quantity stepper and kcal. */
export function MealItemEditor({
  item,
  onQuantityChange,
  onRemove,
}: {
  item: EditableItem;
  onQuantityChange: (quantity: number) => void;
  onRemove?: () => void;
}) {
  const unsure = item.confidence != null && item.confidence < LOW_CONFIDENCE;
  const step = unitStep(item.unit);
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-card bg-surface p-4",
        unsure && "border-[1.5px] border-caution p-[14.5px]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">{sentenceCase(item.name)}</span>
          <span className="text-[13px] font-medium text-ink-3 tabular-nums">
            {formatPortion(item.quantity, item.unit, item.grams)}
            {item.approximate && " · estimated"}
          </span>
          {unsure && (
            <span className="mt-1 w-fit rounded-full bg-caution-soft px-2.5 py-0.5 text-[12px] font-semibold text-caution-text">
              Not sure — check this
            </span>
          )}
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.name}`}
            className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:text-ink"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Stepper
          label={`${item.name} quantity`}
          value={item.quantity}
          step={step}
          onChange={onQuantityChange}
        />
        <span className="text-base font-bold tabular-nums">
          {formatInt(item.kcal)} <span className="text-[13px] font-semibold text-ink-3">kcal</span>
        </span>
      </div>
    </div>
  );
}
