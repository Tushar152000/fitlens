"use client";

import { Check, ChevronDown, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * One part of the merged "About you" step: a card whose header folds it open and shut. Folded, the
 * header shows the answers so far in one line, a tick when the part is complete, or a warning when
 * it holds an error. The panel stays mounted and animates its height (grid rows 0fr ↔ 1fr), so
 * folding is smooth and answers keep their state; a folded panel is `inert`.
 */
export function FoldSection({
  id,
  icon,
  title,
  summary,
  done,
  attention,
  open,
  onToggle,
  children,
}: {
  id: string;
  /** Shown in the badge until the part is done (then a tick) or has an error (a warning). */
  icon: ReactNode;
  title: string;
  summary: string;
  done: boolean;
  attention: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panel = `${id}-panel`;
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-28 rounded-3xl bg-white shadow-[0_0_0_1px_var(--color-line)] transition-shadow duration-300",
        open && "shadow-[0_0_0_1.5px_var(--color-fitr8)]",
      )}
    >
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panel}
          className={cn(
            // Fills the card's top edge; open, it meets the panel's divider squarely (no pill).
            "flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors duration-200 outline-none hover:bg-sunken/60 focus-visible:bg-sunken/60 lg:px-6",
            open ? "rounded-t-3xl" : "rounded-3xl",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
              attention
                ? "bg-caution-soft text-caution-text"
                : done
                  ? "bg-fitr8 text-white"
                  : "bg-fitr8-lilac-soft text-fitr8",
            )}
          >
            {attention ? (
              <CircleAlert className="size-4" />
            ) : done ? (
              <Check className="size-4" strokeWidth={3} />
            ) : (
              icon
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-lg font-semibold tracking-[-0.01em]">{title}</span>
            {/* The summary line folds away with the panel instead of popping. */}
            <span
              aria-hidden={open}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
                open ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
              )}
            >
              <span
                className={cn(
                  "min-h-0 truncate overflow-hidden text-sm",
                  attention ? "font-semibold text-caution-text" : "text-ink-3",
                )}
              >
                {attention ? "Something here needs a look" : summary || "Not answered yet"}
              </span>
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-5 shrink-0 text-ink-3 transition-transform duration-300 ease-out motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
      </h2>
      <div
        id={panel}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        {/* min-h-0 + overflow-hidden let the row collapse to nothing. */}
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-x-5 gap-y-6 border-t border-line px-5 pt-5 pb-6 md:grid-cols-2 lg:gap-y-7 lg:px-6">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
