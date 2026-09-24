"use client";

import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { FieldError } from "./field-error";

export interface NumberFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> {
  label: string;
  unit?: string;
  value: string;
  onValueChange: (value: string) => void;
  hint?: string;
  error?: string;
}

/** Label above, 52 px box, big value with a unit suffix. Keeps the raw string so users can type "7" then "72.5". */
export function NumberField({
  label,
  unit,
  value,
  onValueChange,
  hint,
  error,
  className,
  id,
  ...props
}: NumberFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      <div
        className={cn(
          "flex h-[52px] items-center rounded-input border bg-surface px-4 transition-colors",
          "focus-within:border-ink",
          error ? "border-caution" : "border-line-strong",
        )}
      >
        <input
          suppressHydrationWarning
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onValueChange(e.target.value.replace(",", "."))}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? hintId : undefined}
          className="w-full min-w-0 bg-transparent text-lg font-semibold tabular-nums outline-none placeholder:text-ink-3/60"
          {...props}
        />
        {unit && <span className="ml-2 shrink-0 text-[15px] font-medium text-ink-3">{unit}</span>}
      </div>
      {error ? (
        <FieldError id={hintId}>{error}</FieldError>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
