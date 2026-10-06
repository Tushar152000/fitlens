"use client";

import { BatteryLow, CircleCheck, Coffee, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StickyFooter } from "@/components/sticky-footer";
import { Button, Segmented } from "@/components/ui";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatInt } from "@fitr8/domain/format";
import type { TodayWorkoutDto } from "@fitr8/contracts";
import type { Energy } from "@fitr8/domain/training";

const weekday = (ymd: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(new Date(ymd));

export function Briefing({ data, energy }: { data: TodayWorkoutDto; energy: Energy }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [snackState, setSnackState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const session = data.session;

  function setEnergy(next: Energy) {
    startTransition(() => router.replace(`/workout/brief?energy=${next}`, { scroll: false }));
  }

  async function logSnack() {
    if (!data.snack) return;
    setSnackState("saving");
    setError(null);
    try {
      if (data.snack.log.kind === "usual") {
        await api("/api/meals/relog", {
          method: "POST",
          json: { mealId: data.snack.log.mealId, mealType: "SNACK" },
        });
      } else {
        await api("/api/meals/log-items", {
          method: "POST",
          json: { mealType: "SNACK", items: data.snack.log.items },
        });
      }
      setSnackState("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't log it. Try again.");
      setSnackState("idle");
    }
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <p className="text-[13px] font-semibold text-ink-3">Coach briefing</p>
          <h1 className="display text-[28px] leading-tight">Rest day</h1>
        </header>
        <p className="rounded-card bg-surface p-4 text-ink-2">{data.cardio}</p>
        {data.nextDay && (
          <p className="text-ink-2">
            Next: <span className="font-semibold text-ink">{data.nextDay.name}</span> on{" "}
            {weekday(data.nextDay.date)}.
          </p>
        )}
        <Button asChild variant="secondary">
          <Link href="/workout">See this week</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", pending && "opacity-60")}>
      <header>
        <p className="text-[13px] font-semibold text-ink-3">
          Coach briefing{data.deload ? " · deload week" : ""}
        </p>
        <h1 className="display text-[28px] leading-tight">
          {session.name} · {data.sessionMinutes} min
        </h1>
      </header>

      {/* Fuel card */}
      <section
        aria-label="Fuel"
        className={cn(
          "flex items-center gap-3 rounded-card p-4",
          data.fuel.low ? "bg-caution-soft" : "bg-protein-soft",
        )}
      >
        {data.fuel.low ? (
          <BatteryLow className="size-6 shrink-0 text-caution-text" aria-hidden />
        ) : (
          <CircleCheck className="size-6 shrink-0 text-protein" aria-hidden />
        )}
        <div className="min-w-0">
          <p className={cn("font-bold", data.fuel.low ? "text-caution-text" : "text-protein")}>
            {data.fuel.low ? "Running low" : "Fuelled"}
          </p>
          <p className="text-[13px] text-ink-2 tabular-nums">
            {formatInt(data.fuel.eatenKcal)} of {formatInt(data.fuel.targetKcal)} kcal so far today
          </p>
        </div>
      </section>

      {data.fuel.low && data.snack && (
        <section
          aria-label="Pre-workout snack"
          className="flex flex-col gap-3 rounded-card bg-surface p-4"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sunken text-ink-2">
              <Coffee className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-ink-3">
                Before you train{data.snack.usual ? " · one of your usuals" : ""}
              </p>
              <p className="font-semibold">{data.snack.name}</p>
              <p className="text-[13px] text-ink-3 tabular-nums">
                P {data.snack.proteinG} g · C {data.snack.carbsG} g · {formatInt(data.snack.kcal)}{" "}
                kcal
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={logSnack} disabled={snackState !== "idle"}>
            {snackState === "saving"
              ? "Logging…"
              : snackState === "done"
                ? "Logged as a snack"
                : "Log it"}
          </Button>
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-brand">
              {error}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="energy-heading" className="flex flex-col gap-2">
        <h2 id="energy-heading" className="text-[13px] font-semibold text-ink-2">
          How&apos;s your energy?
        </h2>
        <Segmented
          label="Energy"
          value={energy}
          onChange={setEnergy}
          options={[
            { value: "great", label: "Great" },
            { value: "ok", label: "OK" },
            { value: "tired", label: "Tired" },
          ]}
        />
      </section>

      <section
        aria-labelledby="coach-heading"
        className="flex flex-col gap-3 rounded-card bg-ink p-5 text-white"
      >
        <h2
          id="coach-heading"
          className="flex items-center gap-2 text-[13px] font-semibold text-white/70"
        >
          <Sparkles className="size-4 text-brand-glow" aria-hidden />
          What your coach set today
        </h2>
        <ul className="flex flex-col gap-3">
          {session.rules.map((r) => (
            <li key={r.title}>
              <p className="font-semibold">{r.title}</p>
              <p className="text-[13px] text-white/75">{r.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="today-list" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 id="today-list" className="display text-[19px]">
            Today
          </h2>
          <span className="text-[13px] font-semibold text-ink-3 tabular-nums">
            ~{session.estimatedMinutes} min
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-line rounded-card bg-surface">
          {session.exercises.map((e) => {
            const trimmed = e.sets < e.plannedSets;
            return (
              <li key={e.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{e.name}</span>
                  <span className="text-[12px] font-semibold text-ink-3">
                    {e.role === "main"
                      ? "Main lift"
                      : e.role === "secondary"
                        ? "Second lift"
                        : "Accessory"}{" "}
                    · {e.rir} in reserve{e.bonusRep ? " · +1 rep on last set" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums">
                  <span className={cn(trimmed && "text-protein")}>
                    {e.sets} × {e.repMin}–{e.repMax}
                    {e.timed ? " s" : ""}
                  </span>
                  {trimmed && (
                    <span className="block text-[12px] font-semibold text-protein">
                      was {e.plannedSets} sets
                    </span>
                  )}
                  {e.targetKg != null && (
                    <span className="block text-[13px] font-medium text-ink-3">
                      {e.targetKg} kg
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Inside the tabs group, so it sits above the fixed 84 px tab bar. */}
      <StickyFooter gutter={20} className="bottom-[calc(84px+env(safe-area-inset-bottom))] pb-4">
        <Button asChild>
          <Link href={`/workout?energy=${energy}`}>Start workout</Link>
        </Button>
      </StickyFooter>
    </div>
  );
}
