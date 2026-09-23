"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/** Native date input styled like NumberField (label above, 52 px box). Value is YYYY-MM-DD. */
export function DateField({
  label,
  value,
  onValueChange,
  min,
  max,
  error,
  hint,
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  error?: string;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onValueChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-hint` : undefined}
        className={cn(
          "h-[52px] w-full rounded-input border bg-surface px-4 text-lg font-semibold tabular-nums outline-none focus:border-ink",
          error ? "border-brand" : "border-line-strong",
        )}
      />
      {(error || hint) && (
        <p
          id={`${id}-hint`}
          className={cn("text-[13px]", error ? "font-semibold text-brand" : "text-ink-3")}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
