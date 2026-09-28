"use client";

import { cn } from "@/lib/cn";

/** 48×28 switch, brand when on. Pass `aria-labelledby` or `label`. */
export function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  labelledBy?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-150",
        "before:absolute before:-inset-2 before:content-['']",
        checked ? "bg-brand" : "bg-line-strong",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-seg transition-transform duration-150 ease-out",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
