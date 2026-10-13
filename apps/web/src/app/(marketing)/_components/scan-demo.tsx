"use client";

import { Check, Minus, Plus, ScanLine, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatInt } from "@fitr8/domain/format";
import { useCountUp } from "./use-count-up";

/**
 * Sample scan of the hero photo: per-unit nutrition for what's on that plate, with app-like
 * portion steps. `x`/`y` place each chip over its food (% of the 3:2 photo); `flip` puts the label
 * left of the dot near the right edge. The dressing is the low-confidence item (DESIGN.md: never
 * hide uncertainty).
 */
const FOODS = [
  {
    id: "avo",
    name: "Avocado",
    short: "Avocado",
    unit: "fruit",
    qty: 0.5,
    step: 0.5,
    g: 200,
    kcal: 320,
    p: 4,
    c: 17,
    f: 29,
    x: 44,
    y: 74,
  },
  {
    id: "chick",
    name: "Chickpeas",
    short: "Chickpeas",
    unit: "cup",
    qty: 0.5,
    step: 0.25,
    g: 164,
    kcal: 269,
    p: 14.5,
    c: 45,
    f: 4.2,
    x: 55,
    y: 53,
  },
  {
    id: "sweet",
    name: "Roasted sweet potato",
    short: "Sweet potato",
    unit: "cup",
    qty: 1,
    step: 0.5,
    g: 133,
    kcal: 114,
    p: 2,
    c: 27,
    f: 0.1,
    x: 77,
    y: 63,
    flip: true,
  },
  {
    id: "tom",
    name: "Cherry tomatoes",
    short: "Tomatoes",
    unit: "pieces",
    qty: 6,
    step: 1,
    g: 17,
    kcal: 3,
    p: 0.15,
    c: 0.65,
    f: 0.03,
    x: 41,
    y: 31,
  },
  {
    id: "dress",
    name: "Tahini dressing",
    short: "Dressing",
    unit: "tbsp",
    qty: 2,
    step: 1,
    g: 15,
    kcal: 45,
    p: 1,
    c: 1.5,
    f: 4,
    x: 60,
    y: 39,
    unsure: true,
  },
  {
    id: "greens",
    name: "Greens and cabbage",
    short: "Greens",
    unit: "cup",
    qty: 1,
    step: 0.5,
    g: 60,
    kcal: 15,
    p: 1,
    c: 3,
    f: 0.2,
    x: 74,
    y: 14,
    flip: true,
  },
] as const;

type FoodId = (typeof FOODS)[number]["id"];
const SCAN_MS = 1300;
const STAGGER_MS = 90;
// Bars fill against a typical lunch share of the 82 kg example's day.
const LUNCH = { p: 50, c: 70, f: 18 };

const FRACTIONS: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };
/** 1.5 → "1½", 0.25 → "¼". */
const fraction = (q: number) => {
  const whole = Math.floor(q);
  const part = FRACTIONS[String(+(q - whole).toFixed(2))] ?? "";
  return whole ? `${whole}${part}` : part;
};

export function ScanDemo() {
  const [qty, setQty] = useState<Record<FoodId, number>>(
    () => Object.fromEntries(FOODS.map((f) => [f.id, f.qty])) as Record<FoodId, number>,
  );
  const [checked, setChecked] = useState(false);
  const [selected, setSelected] = useState<FoodId | null>(null);
  const [scanning, setScanning] = useState(false);
  const [staggered, setStaggered] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const timers = useRef<number[]>([]);

  function scan() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timers.current.forEach(clearTimeout);
    setScanning(true);
    timers.current = [
      window.setTimeout(() => {
        setStaggered(true);
        setScanning(false);
      }, SCAN_MS),
      window.setTimeout(() => setStaggered(false), SCAN_MS + 1200),
    ];
  }

  useEffect(() => {
    const t = window.setTimeout(scan, 500);
    const pending = timers.current;
    return () => {
      clearTimeout(t);
      pending.forEach(clearTimeout);
    };
  }, []);

  function select(id: FoodId) {
    setSelected((s) => (s === id ? null : id));
    listRef.current
      ?.querySelector(`[data-id="${id}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function step(id: FoodId, dir: 1 | -1) {
    const f = FOODS.find((x) => x.id === id)!;
    setQty((q) => ({ ...q, [id]: Math.max(f.step, +(q[id] + f.step * dir).toFixed(2)) }));
    setSelected(id);
    if ("unsure" in f) setChecked(true);
  }

  const totals = FOODS.reduce(
    (t, f) => ({
      kcal: t.kcal + qty[f.id] * f.kcal,
      p: t.p + qty[f.id] * f.p,
      c: t.c + qty[f.id] * f.c,
      f: t.f + qty[f.id] * f.f,
    }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  const shownKcal = useCountUp(totals.kcal);

  return (
    <div className="relative">
      <div className="relative aspect-[3/2] overflow-hidden rounded-[28px] bg-fitr8-deep shadow-hard-lg">
        <Image
          src="/landing/hero-plate.jpg"
          alt="A bowl of avocado, chickpeas, roasted sweet potato, cherry tomatoes, greens and a tahini drizzle"
          fill
          priority
          sizes="(min-width: 1024px) 600px, 100vw"
          className="object-cover"
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-transparent from-55% to-fitr8-ink/35"
        />
        {(
          [
            "top-3.5 left-3.5 border-t-3 border-l-3 rounded-tl-xl",
            "top-3.5 right-3.5 border-t-3 border-r-3 rounded-tr-xl",
            "bottom-3.5 left-3.5 border-b-3 border-l-3 rounded-bl-xl",
            "right-3.5 bottom-3.5 border-r-3 border-b-3 rounded-br-xl",
          ] as const
        ).map((c) => (
          <span
            key={c}
            aria-hidden
            className={`absolute z-[2] size-6 border-white sm:size-[34px] ${c}`}
          />
        ))}
        {scanning && (
          <span
            aria-hidden
            className="absolute inset-x-[4%] z-[3] h-[3px] animate-[plate-scan_1.3s_var(--ease-out)_1] rounded-full bg-fitr8-lilac shadow-[0_0_18px_4px_rgb(224_184_255/0.8)]"
          />
        )}
        {FOODS.map((f, i) => {
          const unsure = "unsure" in f && !checked;
          const flip = "flip" in f;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => select(f.id)}
              aria-pressed={selected === f.id}
              aria-label={`${f.name}, ${formatInt(qty[f.id] * f.kcal)} kcal${unsure ? ", not sure, check this" : ""}`}
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                transitionDelay: staggered ? `${i * STAGGER_MS}ms` : undefined,
              }}
              className={cn(
                "absolute z-[4] inline-flex h-[26px] items-center gap-[5px] rounded-full text-[11px] font-semibold whitespace-nowrap shadow-[0_4px_14px_rgb(21_23_36/0.25)] sm:h-8 sm:gap-[7px] sm:text-[13px]",
                "transition-[transform,opacity,background-color] duration-200 ease-out",
                flip
                  ? "-translate-x-[calc(100%-9px)] -translate-y-1/2 flex-row-reverse pr-1 pl-[11px]"
                  : "-translate-x-[9px] -translate-y-1/2 pr-[11px] pl-1",
                unsure
                  ? "bg-caution-soft text-caution-text ring-2 ring-caution"
                  : "bg-white/95 text-fitr8-ink",
                selected === f.id
                  ? "scale-[1.06] bg-white ring-3 ring-fitr8"
                  : "hover:scale-[1.06]",
                scanning && "scale-60 opacity-0",
              )}
            >
              <span
                className={cn(
                  "grid size-[18px] place-items-center rounded-full after:size-2 after:rounded-full after:bg-white sm:size-[22px]",
                  unsure ? "bg-caution" : "bg-fitr8",
                )}
              />
              <span>{f.short}</span>
              <span
                className={cn(
                  "hidden tabular-nums sm:inline",
                  unsure ? "text-caution-text" : "text-ink-3",
                )}
              >
                {formatInt(qty[f.id] * f.kcal)} kcal
              </span>
            </button>
          );
        })}
      </div>

      <div
        aria-live="polite"
        style={{ transitionDelay: staggered ? `${FOODS.length * STAGGER_MS}ms` : undefined }}
        className={cn(
          "relative z-[5] mx-auto -mt-7 w-full rounded-[20px] bg-white px-[18px] pt-[18px] pb-3.5 text-fitr8-ink shadow-hard sm:-mt-16 sm:mr-0 sm:w-[min(400px,92%)]",
          "transition-[opacity,transform] duration-300 ease-out",
          scanning && "translate-y-4 opacity-0",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.06em] text-ink-3 uppercase">
              Lunch · sample scan
            </p>
            <p className="text-[34px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
              {formatInt(shownKcal)}{" "}
              <span className="text-sm font-semibold tracking-normal text-ink-3">kcal</span>
            </p>
          </div>
          {checked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-protein-soft px-2.5 py-1 text-xs font-semibold text-protein">
              <Check className="size-3.5" strokeWidth={2.6} aria-hidden />
              All checked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-caution-soft px-2.5 py-1 text-xs font-semibold text-caution-text">
              <TriangleAlert className="size-3.5" strokeWidth={2.6} aria-hidden />1 to check
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2.5 text-xs font-semibold text-ink-2">
          {(
            [
              ["Protein", totals.p, LUNCH.p, "bg-protein"],
              ["Carbs", totals.c, LUNCH.c, "bg-carbs"],
              ["Fat", totals.f, LUNCH.f, "bg-fat"],
            ] as const
          ).map(([label, g, of, fill]) => (
            <div key={label}>
              {label} <span className="tabular-nums">{Math.round(g)} g</span>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <i
                  className={`block h-full rounded-full transition-[width] duration-300 ${fill}`}
                  style={{ width: `${Math.min(100, (g / of) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <ul ref={listRef} className="mt-3 flex max-h-[214px] flex-col overflow-y-auto">
          {FOODS.map((f) => {
            const q = qty[f.id];
            const unsure = "unsure" in f && !checked;
            const unit = f.unit === "pieces" && q === 1 ? "piece" : f.unit;
            return (
              <li
                key={f.id}
                data-id={f.id}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-xl px-2 py-[7px] transition-colors",
                  selected === f.id && "bg-fitr8-lilac-soft",
                )}
              >
                <button type="button" onClick={() => select(f.id)} className="text-left">
                  <span className="block text-sm leading-tight font-semibold">{f.name}</span>
                  <span className="block text-xs text-ink-3 tabular-nums">
                    {fraction(q)} {unit} · {formatInt(q * f.g)} g
                  </span>
                  {unsure && (
                    <span className="mt-1 inline-block rounded-full bg-caution-soft px-[7px] py-px text-[11px] font-semibold text-caution-text">
                      Not sure, check this
                    </span>
                  )}
                </button>
                <span className="flex items-center gap-0.5 rounded-full bg-fitr8-soft p-0.5">
                  <button
                    type="button"
                    onClick={() => step(f.id, -1)}
                    disabled={q <= f.step}
                    aria-label={`Less ${f.name}`}
                    className="grid size-7 place-items-center rounded-full text-ink-2 hover:bg-white hover:text-fitr8 disabled:opacity-35 disabled:hover:bg-transparent"
                  >
                    <Minus className="size-3.5" strokeWidth={2.5} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(f.id, 1)}
                    aria-label={`More ${f.name}`}
                    className="grid size-7 place-items-center rounded-full text-ink-2 hover:bg-white hover:text-fitr8"
                  >
                    <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
                  </button>
                </span>
                <span className="min-w-14 text-right text-sm font-semibold tabular-nums">
                  {formatInt(q * f.kcal)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-2.5 flex items-center justify-between gap-2.5 border-t border-line pt-2.5 text-xs font-semibold text-ink-3">
          <span>Tap a food on the photo, or adjust a portion</span>
          <button
            type="button"
            onClick={scan}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-fitr8-lilac-soft px-3 py-[7px] text-[13px] font-semibold text-fitr8 hover:bg-fitr8-lilac"
          >
            <ScanLine className="size-[15px]" aria-hidden />
            Scan again
          </button>
        </div>
      </div>
    </div>
  );
}
