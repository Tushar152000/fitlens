"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface ChoiceCardGroupProps<T extends string> {
  label: string;
  options: ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  className?: string;
}

/** Radio cards. Selected = 2 px brand border and a filled dot. */
export function ChoiceCardGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: ChoiceCardGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-col gap-2.5", className)}>
      {options.map((o) => (
        <ChoiceCard
          key={o.value}
          selected={o.value === value}
          onSelect={() => onChange(o.value)}
          {...o}
        />
      ))}
    </div>
  );
}

export function ChoiceCard({
  label,
  description,
  icon,
  selected,
  onSelect,
}: {
  label: string;
  description?: string;
  icon?: ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-input bg-surface px-4 py-3 text-left transition-colors duration-150",
        selected
          ? "border-2 border-brand px-[15px] py-[11px]"
          : "border border-line-strong hover:border-ink-3",
      )}
    >
      {icon && (
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            selected ? "bg-brand/10 text-brand" : "bg-sunken text-ink-2",
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-semibold">{label}</span>
        {description && <span className="text-[13px] text-ink-3">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "grid size-[22px] shrink-0 place-items-center rounded-full border-2",
          selected ? "border-brand" : "border-line-strong",
        )}
      >
        {selected && <span className="size-2.5 rounded-full bg-brand" />}
      </span>
    </button>
  );
}
