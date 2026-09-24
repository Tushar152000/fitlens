"use client";

import { BadgeCheck, ChevronLeft, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StickyFooter } from "@/components/sticky-footer";
import { Button, NumberField, Stepper } from "@/components/ui";
import { api } from "@/lib/client/api";
import { formatInt, MEAL_LABEL, type MealType } from "@/lib/format";
import { labelAddsUp } from "@/lib/label";

const str = (n: number | null) => (n == null ? "" : String(Math.round(n * 10) / 10));
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function CheckLabel({
  scanId,
  mealType,
  initial,
}: {
  scanId: string;
  mealType: MealType;
  initial: {
    name: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    servingSizeG: number | null;
    servingLabel: string | null;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [kcal, setKcal] = useState(str(initial.kcal));
  const [protein, setProtein] = useState(str(initial.protein));
  const [carbs, setCarbs] = useState(str(initial.carbs));
  const [fat, setFat] = useState(str(initial.fat));
  const [serving, setServing] = useState(str(initial.servingSizeG ?? 100));
  const [servings, setServings] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values = { kcal: num(kcal), protein: num(protein), carbs: num(carbs), fat: num(fat) };
  const allNumbers = Object.values(values).every((v) => Number.isFinite(v) && v >= 0);
  const check = allNumbers ? labelAddsUp(values) : null;
  const servingG = num(serving);
  const grams = Number.isFinite(servingG) && servingG > 0 ? servingG * servings : 0;
  const total = allNumbers ? (values.kcal * grams) / 100 : 0;
  const canSave = allNumbers && grams > 0 && name.trim().length >= 2;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/foods/label/${scanId}/save`, {
        method: "POST",
        json: {
          name: name.trim(),
          per100g: values,
          servingSizeG: servingG,
          servingLabel: initial.servingLabel ?? undefined,
          quantity: servings,
          unit: "serving",
          grams,
          mealType,
          isLiquid: false,
        },
      });
      router.push("/today");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center px-3 pt-3">
        <Link
          href={`/log/label?meal=${mealType}`}
          aria-label="Retake photo"
          className="grid size-11 place-items-center rounded-full hover:bg-sunken"
        >
          <ChevronLeft className="size-6" />
        </Link>
      </div>
      <main className="flex flex-1 flex-col gap-4 px-5 pt-1">
        <div>
          <h1 className="display text-[26px] leading-tight">Check the label values</h1>
          <p className="mt-1 text-ink-2">
            We read these per 100 g. Fix anything that doesn&apos;t match the pack.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="label-name" className="text-[13px] font-semibold text-ink-2">
            Product name
          </label>
          <input
            suppressHydrationWarning
            id="label-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Parle-G Gold"
            className="h-[52px] rounded-input border border-line-strong bg-surface px-4 text-base outline-none focus:border-ink"
          />
        </div>

        {check &&
          (check.ok ? (
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-protein-soft px-3 py-1 text-[13px] font-semibold text-protein">
              <BadgeCheck className="size-4" aria-hidden />
              Numbers add up
            </p>
          ) : (
            <div className="flex gap-2.5 rounded-card bg-caution-soft p-3 text-caution-text">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p className="text-[13px]">
                <span className="font-bold">Please check.</span> Protein, carbs and fat add up to{" "}
                {formatInt(check.fromMacros)} kcal, but energy says {formatInt(values.kcal)} kcal.
              </p>
            </div>
          ))}

        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Energy" unit="kcal" value={kcal} onValueChange={setKcal} />
          <NumberField label="Protein" unit="g" value={protein} onValueChange={setProtein} />
          <NumberField label="Carbs" unit="g" value={carbs} onValueChange={setCarbs} />
          <NumberField label="Fat" unit="g" value={fat} onValueChange={setFat} />
        </div>

        <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
          <NumberField
            label="Serving size"
            unit="g"
            value={serving}
            onValueChange={setServing}
            hint={initial.servingLabel ? `Label says: ${initial.servingLabel}` : undefined}
          />
          <div className="flex items-center justify-between">
            <span className="font-semibold">Servings</span>
            <Stepper
              label="Servings"
              value={servings}
              step={0.5}
              min={0.5}
              onChange={setServings}
            />
          </div>
        </div>

        <StickyFooter gutter={20} className="flex flex-col gap-3">
          <div className="flex items-end justify-between rounded-card bg-surface px-4 py-3">
            <div>
              <p className="text-[12px] font-semibold text-ink-3">Total</p>
              <p className="display text-[26px] leading-none tabular-nums" aria-live="polite">
                {formatInt(total)}{" "}
                <span className="text-[13px] font-semibold text-ink-3">kcal</span>
              </p>
            </div>
            <p className="text-[13px] font-semibold text-ink-3 tabular-nums">
              {formatInt(grams)} g
            </p>
          </div>
          {error && (
            <p role="alert" className="text-center text-[13px] font-semibold text-brand">
              {error}
            </p>
          )}
          <Button onClick={save} disabled={busy || !canSave}>
            {busy ? "Saving…" : `Save and add to ${MEAL_LABEL[mealType].toLowerCase()}`}
          </Button>
        </StickyFooter>
      </main>
    </div>
  );
}
