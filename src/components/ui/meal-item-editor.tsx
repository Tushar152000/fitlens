"use client";

import { Pencil, X } from "lucide-react";
import { useState } from "react";
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
  isLiquid?: boolean;
}

/** One detected item: name, portion, low-confidence flag, quantity stepper and kcal. */
export function MealItemEditor({
  item,
  onQuantityChange,
  onAmountChange,
  onRemove,
}: {
  item: EditableItem;
  onQuantityChange: (quantity: number) => void;
  /** Exact amount in g (ml for drinks). When set, tapping the portion line edits it. */
  onAmountChange?: (grams: number) => void;
  onRemove?: () => void;
}) {
  const unsure = item.confidence != null && item.confidence < LOW_CONFIDENCE;
  const step = unitStep(item.unit);
  const measure = item.isLiquid ? "ml" : "g";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const portion = (
    <>
      {formatPortion(item.quantity, item.unit, item.grams, item.isLiquid)}
      {item.approximate && " · estimated"}
    </>
  );

  function commit() {
    const n = Number(draft);
    if (Number.isFinite(n) && n > 0 && n <= 3000) onAmountChange?.(n);
    setEditing(false);
  }

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
          {editing ? (
            <form
              suppressHydrationWarning
              className="mt-1 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                commit();
              }}
            >
              <label className="flex h-11 items-center gap-1.5 rounded-input border border-ink bg-surface px-3">
                <span className="sr-only">Amount in {measure}</span>
                <input
                  suppressHydrationWarning
                  autoFocus
                  inputMode="decimal"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.replace(",", "."))}
                  onBlur={commit}
                  className="w-16 bg-transparent text-[15px] font-semibold tabular-nums outline-none"
                />
                <span className="text-[13px] font-semibold text-ink-3">{measure}</span>
              </label>
              <button type="submit" className="min-h-11 px-2 text-[13px] font-semibold text-brand">
                Done
              </button>
            </form>
          ) : onAmountChange ? (
            <button
              type="button"
              onClick={() => {
                setDraft(String(Math.round(item.grams)));
                setEditing(true);
              }}
              aria-label={`Change amount, now ${Math.round(item.grams)} ${measure}`}
              className="-mx-1 -my-2 flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-1 text-left text-[13px] font-medium text-ink-3 tabular-nums hover:text-ink"
            >
              <span>{portion}</span>
              <Pencil className="size-3.5 shrink-0" aria-hidden />
            </button>
          ) : (
            <span className="text-[13px] font-medium text-ink-3 tabular-nums">{portion}</span>
          )}
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
