"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { StickyFooter } from "@/components/sticky-footer";
import { Button, ChoiceCard, ProgressSteps } from "@/components/ui";
import { api } from "@/lib/client/api";

type Choice = "KEEP_GOAL" | "KEEP_DATE";

const dateLabel = (ymd: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ymd));

/** Design 5b: the goal needs an unsafe pace; pick a later date or a closer target. */
export function TooFastPlan({
  losing,
  neededWeeklyKg,
  safeWeeklyKg,
  targetWeightKg,
  targetDate,
  suggestedDate,
  closerTargetKg,
  targetCard,
}: {
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
      router.push("/today");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col px-6 pt-4">
      <div className="flex h-11 items-center">
        <ProgressSteps current={4} total={4} className="flex-1" />
      </div>
      <p className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-caution-soft px-3 py-1 text-[13px] font-semibold text-caution-text">
        <TriangleAlert className="size-4" aria-hidden />
        Too fast to be safe
      </p>
      <h1 className="mt-3 display text-[28px] leading-tight">
        {verb} {Math.abs(neededWeeklyKg).toFixed(1)} kg a week isn&apos;t safe
      </h1>
      <p className="mt-2 text-ink-2">
        A safe pace for you is about {Math.abs(safeWeeklyKg).toFixed(1)} kg a week. Pick what
        matters more:
      </p>

      <div role="radiogroup" aria-label="Safer option" className="mt-5 flex flex-col gap-2.5">
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

      <p className="mt-5 text-[13px] font-semibold text-ink-3">Your daily target either way</p>
      <div className="mt-2">{targetCard}</div>

      <StickyFooter className="flex flex-col gap-2 pt-8">
        {error && (
          <p role="alert" className="text-center text-[13px] font-semibold text-brand">
            {error}
          </p>
        )}
        <Button onClick={start} disabled={busy}>
          {busy
            ? "Saving…"
            : choice === "KEEP_GOAL" && suggestedDate
              ? `Start — goal by ${dateLabel(suggestedDate)}`
              : `Start — ${closer} kg by ${dateLabel(targetDate)}`}
        </Button>
        <Link
          href="/onboarding"
          className="mx-auto flex min-h-11 items-center px-3 text-[15px] font-semibold text-ink-2 hover:text-ink"
        >
          Change my goal
        </Link>
      </StickyFooter>
    </main>
  );
}
