"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** Dark variant for the camera screen. */
  tone?: "light" | "dark";
}

/** 36 px pill with a 44 px hit area. */
export function Chip({ selected, tone = "light", className, children, ...props }: ChipProps) {
  const styles =
    tone === "dark"
      ? selected
        ? "bg-white text-ink"
        : "bg-white/12 text-white/85 hover:bg-white/20"
      : selected
        ? "bg-ink text-white"
        : "bg-chip text-ink-2 hover:text-ink";
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors duration-150",
        "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
        tone === "dark" ? "px-3.5" : "px-4",
        styles,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Single-select row of chips. */
export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => (
        <Chip key={o.value} selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
