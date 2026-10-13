"use client";

import { ArrowRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps, type ReactNode } from "react";
import { onboardingButton } from "@/components/onboarding/button-styles";
import { OnboardingShell } from "@/components/onboarding/shell";
import { dateLabel } from "@/components/onboarding/steps-meta";
import { ChoiceCard } from "@/components/ui";
import { api } from "@/lib/client/api";

type Choice = "KEEP_GOAL" | "KEEP_DATE";

/** Design 5b: the goal needs an unsafe pace; pick a later date or a closer target. */
export function TooFastPlan({
  shell,
  next,
  losing,
  neededWeeklyKg,
  safeWeeklyKg,
  targetWeightKg,
  targetDate,
  suggestedDate,
  closerTargetKg,
  targetCard,
}: {
  shell: Omit<ComponentProps<typeof OnboardingShell>, "children" | "footer">;
  /** Where "Start" goes: Get the app for new users, Today when editing. */
  next: string;
  losing: boolean;
  neededWeeklyKg: number;
  safeWeeklyKg: number;
  targetWeightKg: number;
  targetDate: string;
  suggestedDate: string | null;
  closerTargetKg: number | null;
  targetCard: ReactNode;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(suggestedDate ? "KEEP_GOAL" : "KEEP_DATE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verb = losing ? "Losing" : "Gaining";
  const closer = closerTargetKg != null ? Math.round(closerTargetKg * 2) / 2 : null;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/goal/option", { method: "POST", json: { choice } });
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  return (
    <OnboardingShell
      {...shell}
      footer={
        <>
          {error && (
            <p role="alert" className="text-center text-[13px] font-semibold text-caution-text">
              {error}
            </p>
          )}
          <button type="button" onClick={start} disabled={busy} className={onboardingButton}>
            {busy
              ? "Saving…"
              : choice === "KEEP_GOAL" && suggestedDate
                ? `Start: goal by ${dateLabel(suggestedDate)}`
                : `Start: ${closer} kg by ${dateLabel(targetDate)}`}
            <ArrowRight className="size-5" aria-hidden />
          </button>
          <Link
            href="/onboarding"
            className="mx-auto flex min-h-11 items-center px-3 text-[15px] font-semibold text-ink-2 hover:text-fitr8-ink"
          >
            Change my goal
          </Link>
        </>
      }
    >
      <div>
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-caution-soft px-3 py-1 text-[13px] font-bold text-caution-text">
          <TriangleAlert className="size-4" aria-hidden />
          Too fast to be safe
        </p>
        <h1 className="mt-3 text-[30px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance lg:text-[38px]">
          {verb} {Math.abs(neededWeeklyKg).toFixed(1)} kg a week isn&apos;t safe
        </h1>
        <p className="mt-2 text-ink-2">
          A safe pace for you is about {Math.abs(safeWeeklyKg).toFixed(1)} kg a week. Pick what
          matters more:
        </p>
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div role="radiogroup" aria-label="Safer option" className="flex flex-col gap-2.5">
          {suggestedDate && (
            <ChoiceCard
              selected={choice === "KEEP_GOAL"}
              onSelect={() => setChoice("KEEP_GOAL")}
              label="Keep the goal · recommended"
              description={`Reach ${targetWeightKg} kg by ${dateLabel(suggestedDate)}`}
            />
          )}
          {closer != null && (
            <ChoiceCard
              selected={choice === "KEEP_DATE"}
              onSelect={() => setChoice("KEEP_DATE")}
              label="Keep the date"
              description={`Reach ${closer} kg by ${dateLabel(targetDate)}, then keep going`}
            />
          )}
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-3">Your daily target either way</p>
          {targetCard}
        </div>
      </div>
    </OnboardingShell>
  );
}
