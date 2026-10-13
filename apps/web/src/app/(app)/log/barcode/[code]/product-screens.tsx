"use client";

import { BadgeCheck, Camera, ChevronLeft, Package, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StickyFooter } from "@/components/sticky-footer";
import { Button, Segmented, Stepper } from "@/components/ui";
import { api } from "@/lib/client/api";
import { formatInt, formatQty, MEAL_LABEL, type MealType } from "@fitr8/domain/format";

export interface ProductDto {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  servingSizeG: number | null;
  servingLabel: string | null;
  isLiquid: boolean;
  source: string;
  verified: boolean;
  per100g: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    sugar: number | null;
    sodiumMg: number | null;
  };
}

function BackBar({ href }: { href: string }) {
  return (
    <div className="flex items-center px-3 pt-3">
      <Link
        href={href}
        aria-label="Back"
        className="grid size-11 place-items-center rounded-full hover:bg-sunken"
      >
        <ChevronLeft className="size-6" />
      </Link>
    </div>
  );
}

/** Design 7d: a known product. Amount in servings (0.5 steps) or grams (5 g steps). */
export function ProductScreen({
  food,
  code,
  mealType,
}: {
  food: ProductDto;
  code: string;
  mealType: MealType;
}) {
  const router = useRouter();
  const hasServing = Boolean(food.servingSizeG);
  const measure = food.isLiquid ? "ml" : "g";
  const [mode, setMode] = useState<"SERVINGS" | "GRAMS">(hasServing ? "SERVINGS" : "GRAMS");
  const [servings, setServings] = useState(1);
  const [grams, setGrams] = useState(hasServing ? food.servingSizeG! : 100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountG = mode === "SERVINGS" && food.servingSizeG ? servings * food.servingSizeG : grams;
  const k = amountG / 100;
  const you = {
    kcal: food.per100g.kcal * k,
    protein: food.per100g.protein * k,
    carbs: food.per100g.carbs * k,
    fat: food.per100g.fat * k,
    sugar: food.per100g.sugar != null ? food.per100g.sugar * k : null,
    sodiumMg: food.per100g.sodiumMg != null ? food.per100g.sodiumMg * k : null,
  };
  const fromOff = food.source === "OPEN_FOOD_FACTS";
  // Stored names carry the brand / barcode to stay unique; the brand is shown separately.
  const displayName = food.name
    .replace(/ · \d+$/, "")
    .replace(food.brand ? ` (${food.brand})` : /$^/, "");
  const mealLabel = MEAL_LABEL[mealType].toLowerCase();

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/meals/quick-add", {
        method: "POST",
        json:
          mode === "SERVINGS" && food.servingSizeG
            ? { foodId: food.id, mealType, quantity: servings, unit: "serving", grams: amountG }
            : { foodId: food.id, mealType, quantity: grams, unit: "g", grams },
      });
      router.push("/today");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add it. Try again.");
      setBusy(false);
    }
  }

  const rows: [string, number | null, number | null, string][] = [
    ["Energy", food.per100g.kcal, you.kcal, "kcal"],
    ["Protein", food.per100g.protein, you.protein, "g"],
    ["Carbs", food.per100g.carbs, you.carbs, "g"],
    ["of which sugar", food.per100g.sugar, you.sugar, "g"],
    ["Fat", food.per100g.fat, you.fat, "g"],
    ["Sodium", food.per100g.sodiumMg, you.sodiumMg, "mg"],
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <BackBar href={`/log/barcode?meal=${mealType}`} />
      <main className="flex flex-1 flex-col px-5 pt-2">
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-protein-soft px-3 py-1 text-[13px] font-semibold text-protein">
          <BadgeCheck className="size-4" aria-hidden />
          {fromOff || food.verified ? "Exact label values" : "Your label scan"}
        </p>

        <div className="mt-4 flex items-start gap-4">
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-card bg-surface">
            {food.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Open Food Facts image
              <img src={food.imageUrl} alt="" className="size-full object-contain" />
            ) : (
              <Package className="size-8 text-ink-3" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            {food.brand && <p className="text-[13px] font-semibold text-ink-3">{food.brand}</p>}
            <h1 className="display text-[24px] leading-tight">{displayName}</h1>
            {food.servingSizeG && (
              <p className="mt-1 text-[13px] text-ink-2 tabular-nums">
                1 serving = {formatQty(food.servingSizeG)} {measure}
                {food.servingLabel && food.servingLabel !== `${food.servingSizeG} ${measure}`
                  ? ` (${food.servingLabel})`
                  : ""}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-card bg-surface p-4">
          {hasServing && (
            <Segmented
              label="Amount in"
              value={mode}
              onChange={setMode}
              options={[
                { value: "SERVINGS", label: "Servings" },
                { value: "GRAMS", label: food.isLiquid ? "Millilitres" : "Grams" },
              ]}
            />
          )}
          <div className="flex items-center justify-between gap-3">
            {mode === "SERVINGS" ? (
              <Stepper
                label="Servings"
                value={servings}
                step={0.5}
                min={0.5}
                onChange={setServings}
              />
            ) : (
              <Stepper
                label={food.isLiquid ? "Millilitres" : "Grams"}
                value={grams}
                step={5}
                min={5}
                onChange={setGrams}
              />
            )}
            <span className="text-[13px] font-semibold text-ink-3 tabular-nums">
              {mode === "SERVINGS" ? `${formatInt(amountG)} ${measure}` : `${measure}`}
            </span>
          </div>
        </div>

        <table className="mt-3 w-full overflow-hidden rounded-card bg-surface text-[15px]">
          <caption className="sr-only">Nutrition per 100 {measure} and for your amount</caption>
          <thead>
            <tr className="text-[12px] font-semibold text-ink-3">
              <th className="px-4 pt-3 pb-1 text-left font-semibold">Nutrition</th>
              <th className="px-2 pt-3 pb-1 text-right font-semibold">per 100 {measure}</th>
              <th className="px-4 pt-3 pb-1 text-right font-semibold">You</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows
              .filter(([, per]) => per != null)
              .map(([label, per, mine, unit]) => (
                <tr key={label} className="border-t border-line">
                  <td
                    className={
                      label.startsWith("of which")
                        ? "px-4 py-2 pl-7 text-ink-2"
                        : "px-4 py-2 font-semibold"
                    }
                  >
                    {label}
                  </td>
                  <td className="px-2 py-2 text-right text-ink-2">
                    {unit === "kcal" ? formatInt(per!) : formatQty(Math.round(per! * 10) / 10)}{" "}
                    {unit}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {unit === "kcal" ? formatInt(mine!) : formatQty(Math.round(mine! * 10) / 10)}{" "}
                    {unit}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {fromOff && (
          <p className="mt-3 text-center text-[12px] text-ink-3">
            Data: Open Food Facts (ODbL).{" "}
            <a
              href={`https://world.openfoodfacts.org/product/${code}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              Report it
            </a>
          </p>
        )}

        <StickyFooter gutter={20} className="flex flex-col gap-3">
          <div className="flex items-end justify-between rounded-card bg-surface px-4 py-3">
            <div>
              <p className="text-[12px] font-semibold text-ink-3">Total</p>
              <p className="display text-[26px] leading-none tabular-nums" aria-live="polite">
                {formatInt(you.kcal)}{" "}
                <span className="text-[13px] font-semibold text-ink-3">kcal</span>
              </p>
            </div>
            <p className="text-[13px] font-semibold text-protein">No AI scan used</p>
          </div>
          {error && (
            <p role="alert" className="text-center text-[13px] font-semibold text-brand">
              {error}
            </p>
          )}
          <Button onClick={add} disabled={busy}>
            {busy ? "Adding…" : `Add to ${mealLabel}`}
          </Button>
        </StickyFooter>
      </main>
    </div>
  );
}

/** Design 7e: unknown (or invalid) barcode → photograph the label, or type the meal. */
export function NotFoundScreen({
  code,
  mealType,
  reason,
}: {
  code: string;
  mealType: MealType;
  reason: "unknown" | "invalid" | "unreachable";
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const labelHref = `/log/label?meal=${mealType}&barcode=${encodeURIComponent(code)}${
    name.trim() ? `&name=${encodeURIComponent(name.trim())}` : ""
  }`;
  const title =
    reason === "invalid"
      ? "That barcode didn't read right"
      : reason === "unreachable"
        ? "We couldn't check this product"
        : "We don't know this product yet";

  return (
    <div className="flex min-h-dvh flex-col">
      <BackBar href={`/log/barcode?meal=${mealType}`} />
      <main className="flex flex-1 flex-col px-5 pt-2">
        <span className="grid size-12 place-items-center rounded-full bg-sunken text-ink-2">
          <SearchX className="size-6" aria-hidden />
        </span>
        <h1 className="mt-3 display text-[26px] leading-tight">{title}</h1>
        <p className="mt-1 text-ink-2">
          {reason === "invalid"
            ? "Scan it again, or photograph the nutrition label instead."
            : reason === "unreachable"
              ? "The product database didn't answer. Photograph the label, or try again in a minute."
              : "Photograph its nutrition label once and it's saved for next time."}
          {reason !== "invalid" && (
            <span className="mt-1 block text-[13px] text-ink-3 tabular-nums">Barcode {code}</span>
          )}
        </p>

        <div className="mt-4 flex flex-col gap-2.5 rounded-card bg-surface p-4">
          <p className="font-semibold">For a good label photo</p>
          <ul className="flex flex-col gap-2 text-[15px] text-ink-2">
            {[
              "Get the whole nutrition table in frame",
              "Include the per 100 g column",
              "Tilt away from lights to avoid glare",
              "Uses 1 photo scan",
            ].map((tip) => (
              <li key={tip} className="flex gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-protein" aria-hidden />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="product-name" className="text-[13px] font-semibold text-ink-2">
            Product name (optional)
          </label>
          <input
            suppressHydrationWarning
            id="product-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Parle-G Gold"
            className="h-[52px] rounded-input border border-line-strong bg-surface px-4 text-base outline-none focus:border-ink"
          />
        </div>

        <StickyFooter gutter={20} className="flex flex-col gap-3">
          <Button onClick={() => router.push(labelHref)}>
            <Camera className="size-5" aria-hidden />
            Photograph the label
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/log/type?meal=${mealType}`}>Type it instead</Link>
          </Button>
        </StickyFooter>
      </main>
    </div>
  );
}
