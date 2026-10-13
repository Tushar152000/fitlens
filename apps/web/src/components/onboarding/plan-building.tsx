"use client";

import { Check, Dumbbell } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const STEPS = [
  "Reading your body stats",
  "Setting calories and macros",
  "Planning your training week",
];
const STEP_MS = 850;
const R = 92;
const CIRC = 2 * Math.PI * R;

/**
 * Full-screen "Building your plan" moment (DESIGN.md 4 → 5): a ring fills as three checks tick.
 * The first two tick on a timer; the last waits for `done`. Still under reduced motion.
 */
export function PlanBuilding({ done }: { done: boolean }) {
  const [ticked, setTicked] = useState(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setTicked((n) => Math.max(n, 1)), 300);
    const t2 = window.setTimeout(() => setTicked((n) => Math.max(n, 2)), 300 + STEP_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const shown = done ? 3 : ticked;
  return (
    <div
      role="status"
      className="fixed inset-0 z-50 flex animate-[fade-in_200ms_ease] flex-col items-center justify-center gap-7 bg-fitr8 px-6 text-center text-white"
    >
      <div className="relative">
        <svg viewBox="0 0 200 200" className="size-[200px] -rotate-90" aria-hidden>
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            strokeWidth="12"
            className="stroke-white/18"
          />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - shown / 3)}
            className="stroke-white transition-[stroke-dashoffset] duration-[850ms] ease-out"
          />
        </svg>
        <Dumbbell
          className="absolute inset-0 m-auto size-16 text-fitr8-lilac motion-safe:animate-[pump_900ms_ease-in-out_infinite_alternate]"
          aria-hidden
        />
      </div>
      <h2 className="text-[26px] font-semibold tracking-[-0.02em]">
        {done ? "Your plan is ready" : "Building your plan"}
      </h2>
      <ul className="flex flex-col gap-2.5 text-left">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              "flex items-center gap-2.5 font-semibold transition-colors",
              i < shown ? "text-white" : "text-white/55",
            )}
          >
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full",
                i < shown
                  ? "bg-white text-fitr8"
                  : "shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.5)]",
              )}
            >
              {i < shown && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
