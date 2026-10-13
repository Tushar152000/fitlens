"use client";

import { Check, Droplet, Info, Undo2 } from "lucide-react";
import { useState } from "react";
import { CalorieRing, MacroBar } from "@/components/ui";
import { api, ApiError } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatInt } from "@fitr8/domain/format";
import type { WaterDayDto } from "@fitr8/contracts";

type Macros = { kcal: number; proteinG: number; carbsG: number; fatG: number };

const litres = (ml: number) => (ml / 1000).toFixed(1);
const QUICK_ADDS = [250, 500] as const;

/**
 * Screen 6 calorie card: ring, macro bars and water (docs/DESIGN.md → Water). Water is the
 * interactive part: +250 / +500 ml chips, undo of the latest entry, and the target's reason.
 */
export function IntakeCard({
  eaten,
  target,
  initialWater,
}: {
  eaten: Macros;
  target: Macros;
  initialWater: WaterDayDto | null;
}) {
  const [water, setWater] = useState(initialWater);
  const [busy, setBusy] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [justAdded, setJustAdded] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(ml: number) {
    if (!water || busy) return;
    const before = water;
    setBusy(true);
    setError(null);
    setJustAdded(ml);
    // Optimistic: the bar moves now; the server's day replaces it when it answers.
    setWater({ ...water, consumedMl: water.consumedMl + ml });
    try {
      const day = await api<WaterDayDto>("/api/water", { method: "POST", json: { ml } });
      setWater(day);
      setStatus(`Added ${ml} ml. ${litres(day.consumedMl)} of ${litres(day.targetMl)} litres.`);
    } catch (e) {
      setWater(before);
      setError(e instanceof ApiError ? e.message : "Couldn't add that. Try again.");
    } finally {
      setBusy(false);
      setTimeout(() => setJustAdded(null), 900);
    }
  }

  async function undo() {
    const last = water?.logs.at(-1);
    if (!water || !last || busy) return;
    const before = water;
    setBusy(true);
    setError(null);
    setWater({ ...water, consumedMl: water.consumedMl - last.ml, logs: water.logs.slice(0, -1) });
    try {
      await api(`/api/water/${last.id}`, { method: "DELETE" });
      setStatus(`Removed ${last.ml} ml.`);
    } catch (e) {
      setWater(before);
      setError(e instanceof ApiError ? e.message : "Couldn't undo that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const waterPct =
    water && water.targetMl > 0 ? Math.min(100, (water.consumedMl / water.targetMl) * 100) : 0;
  const reached = water != null && water.consumedMl >= water.targetMl;
  const lastLog = water?.logs.at(-1);

  return (
    <section
      className="flex flex-col gap-4 rounded-card bg-surface p-4 lg:p-6"
      aria-label="Today's intake"
    >
      <div className="flex items-center gap-5 lg:gap-8">
        <span className="lg:hidden">
          <CalorieRing eaten={eaten.kcal} target={target.kcal} size={148} />
        </span>
        <span className="hidden lg:block">
          <CalorieRing eaten={eaten.kcal} target={target.kcal} size={188} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:gap-4">
          <MacroBar macro="protein" eaten={eaten.proteinG} target={target.proteinG} />
          <MacroBar macro="carbs" eaten={eaten.carbsG} target={target.carbsG} />
          <MacroBar macro="fat" eaten={eaten.fatG} target={target.fatG} />
          {water && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-semibold">Water</span>
                <span className="font-semibold text-ink-2 tabular-nums">
                  {litres(water.consumedMl)} / {litres(water.targetMl)} L
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-track"
                role="meter"
                aria-label={`Water: ${litres(water.consumedMl)} of ${litres(water.targetMl)} litres`}
                aria-valuemin={0}
                aria-valuemax={water.targetMl}
                aria-valuenow={water.consumedMl}
              >
                <div
                  className={cn(
                    "h-full animate-bar-in rounded-full transition-[width,background-color] duration-300 ease-out",
                    reached ? "bg-protein" : "bg-water",
                  )}
                  style={{ width: `${waterPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="border-t border-line pt-3 text-[13px] text-ink-2 tabular-nums">
        {formatInt(eaten.kcal)} eaten of {formatInt(target.kcal)} kcal target
      </p>

      {water && (
        <div className="-mt-1 flex flex-col gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <p
              className={cn(
                "mr-auto inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold tabular-nums",
                reached ? "text-protein" : "text-water",
              )}
            >
              {reached ? (
                <Check className="size-4" strokeWidth={2.5} aria-hidden />
              ) : (
                <Droplet className="size-4" aria-hidden />
              )}
              {reached ? "Target reached" : `${litres(water.targetMl - water.consumedMl)} L left`}
            </p>
            {QUICK_ADDS.map((ml) => (
              <button
                key={ml}
                type="button"
                onClick={() => add(ml)}
                disabled={busy}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center rounded-full bg-water-soft px-2.5 text-[13px] font-semibold text-water tabular-nums",
                  "transition-[background-color,transform] duration-150 hover:bg-water/15 active:scale-95 disabled:opacity-60",
                  justAdded === ml && "animate-pop",
                )}
              >
                +{ml} ml
              </button>
            ))}
            <button
              type="button"
              onClick={undo}
              disabled={busy || !lastLog}
              aria-label={lastLog ? `Undo last ${lastLog.ml} ml` : "Nothing to undo"}
              title={lastLog ? `Undo last ${lastLog.ml} ml` : undefined}
              className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Undo2 className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              aria-expanded={showWhy}
              aria-controls="water-why"
              aria-label="Why this water target"
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-sunken hover:text-ink",
                showWhy ? "bg-sunken text-ink" : "text-ink-3",
              )}
            >
              <Info className="size-4" aria-hidden />
            </button>
          </div>
          {showWhy && (
            <div
              id="water-why"
              className="animate-page-in rounded-input bg-water-soft/60 p-3 text-[13px] text-ink-2"
            >
              <p className="font-semibold text-ink">{water.reason}</p>
              <p className="mt-1">{water.tip}</p>
              {water.caution && <p className="mt-1 font-semibold">{water.caution}</p>}
            </div>
          )}
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-brand">
              {error}
            </p>
          )}
          <p role="status" className="sr-only">
            {status}
          </p>
        </div>
      )}
    </section>
  );
}
