"use client";

import { Calculator, Check } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BareMark, LogoMark } from "@/components/logo";
import { cn } from "@/lib/cn";
import { formatInt } from "@fitr8/domain/format";

/** What the estimate card shows; null until there's enough to compute it. */
export interface ShellEstimate {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** One line under the number, e.g. "Lose fat · 74 kg by 2 Feb 2027". */
  line: string;
  /** False while it's still the preview pace. */
  exact: boolean;
}

/**
 * Onboarding layout (docs/WEBSITE.md §3). Desktop: purple rail with the steps and a live
 * estimate, one question card on the right. Phones: progress bar and an estimate chip on top,
 * the footer (Continue) pinned to the bottom.
 */
export function OnboardingShell({
  steps,
  current,
  reached = current,
  setupSteps = steps.length,
  onStep,
  estimate,
  footer,
  railFooter,
  wide,
  children,
}: {
  steps: readonly string[];
  current: number;
  /** Furthest step reached; earlier ones show a tick and can be revisited. */
  reached?: number;
  /** How many steps the phone progress bar counts (the form, not the plan screens). */
  setupSteps?: number;
  /** Lets the rail jump back to a reached form step. */
  onStep?: (i: number) => void;
  estimate: ShellEstimate | null;
  footer?: ReactNode;
  railFooter?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const [estOpen, setEstOpen] = useState(false);
  const inSetup = current < setupSteps;

  return (
    <div className="min-h-dvh bg-fitr8-soft text-fitr8-ink lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside
        aria-label="Your progress"
        className="relative hidden h-dvh flex-col gap-7 overflow-hidden bg-fitr8 px-7 py-8 text-white lg:sticky lg:top-0 lg:flex"
      >
        <BareMark className="pointer-events-none absolute -right-20 -bottom-16 w-[340px] opacity-[0.07]" />
        <Link href="/" className="flex items-center gap-2.5 self-start" aria-label="FITR8 home">
          <BareMark className="w-[26px]" />
          <span className="text-[22px] font-extrabold tracking-[-0.02em]">FITR8</span>
        </Link>

        <ol className="relative flex flex-col gap-0.5">
          {steps.map((label, i) => {
            const done = i < current || (i <= reached && i !== current && i < setupSteps);
            const can = onStep && i <= reached && i < setupSteps && i !== current;
            const inner = (
              <>
                <span
                  className={cn(
                    "grid size-[26px] shrink-0 place-items-center rounded-full text-xs font-bold",
                    i === current || done
                      ? "bg-white text-fitr8"
                      : "shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.45)]",
                  )}
                >
                  {done && i !== current ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                {label}
              </>
            );
            const cls = cn(
              "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[15px] font-semibold",
              i === current ? "bg-white/14 text-white" : "text-white/70",
              can && "hover:bg-white/8 hover:text-white",
            );
            return (
              <li key={label}>
                {can ? (
                  <button type="button" onClick={() => onStep(i)} className={cls}>
                    {inner}
                  </button>
                ) : (
                  <span aria-current={i === current ? "step" : undefined} className={cls}>
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <EstimateCard estimate={estimate} />
        {railFooter && <div className="relative text-sm text-white/80">{railFooter}</div>}
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-10 flex flex-col gap-3 bg-fitr8-soft/92 px-5 pt-4 pb-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2" aria-label="FITR8 home">
              <LogoMark size={30} />
              <span className="text-[19px] font-extrabold tracking-[-0.02em]">
                FIT<span className="text-fitr8">R8</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setEstOpen((v) => !v)}
              aria-expanded={estOpen}
              aria-controls="estimate-pop"
              className="inline-flex items-center gap-1.5 rounded-full bg-fitr8-lilac-soft px-3 py-1.5 text-[13px] font-bold text-fitr8"
            >
              <Calculator className="size-3.5" aria-hidden />
              {estimate ? (
                <span className="tabular-nums">{formatInt(estimate.kcal)} kcal</span>
              ) : (
                "Estimate soon"
              )}
            </button>
          </div>
          {estOpen && (
            <div
              id="estimate-pop"
              className="rounded-2xl bg-white px-3.5 py-3 text-sm shadow-[0_0_0_1px_var(--color-line)]"
            >
              {estimate ? (
                <>
                  <b className="tabular-nums">
                    {estimate.exact ? "Daily target" : "Estimated daily target"}:{" "}
                    {formatInt(estimate.kcal)} kcal
                  </b>
                  <p className="text-ink-3 tabular-nums">
                    {estimate.line} · P {estimate.proteinG} g · C {estimate.carbsG} g · F{" "}
                    {estimate.fatG} g
                  </p>
                </>
              ) : (
                "Your daily target appears once we know your body stats."
              )}
            </div>
          )}
          {inSetup ? (
            <>
              <div className="flex gap-1" aria-hidden>
                {Array.from({ length: setupSteps }, (_, i) => (
                  <i
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      i <= current ? "bg-fitr8" : "bg-line",
                    )}
                  />
                ))}
              </div>
              <p className="text-xs font-semibold text-ink-3">
                Step {current + 1} of {setupSteps} · {steps[current]}
              </p>
            </>
          ) : (
            <p className="text-xs font-semibold text-ink-3">{steps[current]}</p>
          )}
        </header>

        <main
          key={current}
          className={cn(
            "mx-auto flex w-full flex-1 animate-page-in flex-col gap-6 px-5 pt-2 pb-6 lg:flex-none lg:gap-7 lg:px-10 lg:pt-14",
            wide ? "max-w-[860px]" : "max-w-[640px]",
          )}
        >
          {children}
        </main>

        {footer && (
          <footer className="sticky bottom-0 z-10 bg-gradient-to-t from-fitr8-soft from-70% to-transparent pt-5 pb-[max(16px,env(safe-area-inset-bottom))] lg:pt-2 lg:pb-14">
            <div
              className={cn(
                // Same column as <main> (max width includes its 20 / 40 px gutters).
                "mx-auto flex w-full flex-col gap-2.5 px-5 lg:px-10",
                wide ? "max-w-[860px]" : "max-w-[640px]",
              )}
            >
              {footer}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

function EstimateCard({ estimate }: { estimate: ShellEstimate | null }) {
  return (
    <div
      aria-live="polite"
      className="relative mt-auto rounded-[20px] bg-white p-[18px] text-fitr8-ink shadow-hard"
    >
      <p className="text-xs font-bold tracking-[0.06em] text-ink-3 uppercase">
        {estimate && !estimate.exact ? "Estimated daily target" : "Your daily target"}
      </p>
      {estimate ? (
        <>
          <p className="mt-1 text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] tabular-nums">
            {formatInt(estimate.kcal)}{" "}
            <span className="text-sm font-semibold tracking-normal text-ink-3">kcal</span>
          </p>
          <p className="mt-1.5 text-[13px] text-ink-2">{estimate.line}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-ink-3">
            {(
              [
                ["Protein", estimate.proteinG],
                ["Carbs", estimate.carbsG],
                ["Fat", estimate.fatG],
              ] as const
            ).map(([label, g]) => (
              <div key={label} className="flex flex-col-reverse">
                <dd className="text-[15px] text-fitr8-ink tabular-nums">{g} g</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-ink-2">Appears here as you answer.</p>
          <div className="mt-2.5 h-2.5 w-[70%] rounded-md bg-sunken" />
          <div className="mt-2.5 h-2.5 w-[45%] rounded-md bg-sunken" />
        </>
      )}
    </div>
  );
}
