"use client";

import { ChevronRight, Info, Repeat, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOnline } from "@/components/offline-banner";
import { StickyFooter } from "@/components/sticky-footer";
import { Button, Chip } from "@/components/ui";
import { api } from "@/lib/client/api";
import { queueMeal } from "@/lib/client/offline-queue";
import type { UsualDto } from "@fitlens/contracts";
import {
  formatInt,
  MEAL_LABEL,
  MEAL_TYPES,
  mealTitle,
  type MealType,
} from "@fitlens/domain/format";
import { ModeTabs } from "../mode-tabs";

export type Usual = UsualDto;

export function TypeMealScreen({
  initialMealType,
  usuals,
}: {
  initialMealType: MealType;
  usuals: Usual[];
}) {
  const router = useRouter();
  const online = useOnline();
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // "text" or a usual's mealId
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    setError(null);
    if (value.length < 2) return setError("Tell us what you ate, e.g. 2 roti and 1 katori dal");
    if (!online) {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      queueMeal({ mealType, text: value, date });
      setQueued(true);
      setText("");
      return;
    }
    setBusy("text");
    try {
      const log = await api<{ id: string }>("/api/meals", {
        method: "POST",
        json: { source: "TEXT", mealType, text: value },
      });
      router.push(`/log/${log.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that. Try again.");
      setBusy(null);
    }
  }

  async function relog(u: Usual) {
    setBusy(u.mealId);
    setError(null);
    try {
      await api("/api/meals/relog", { method: "POST", json: { mealId: u.mealId, mealType } });
      router.push("/today");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that. Try again.");
      setBusy(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col px-5 pt-3">
      <div className="flex items-center gap-2">
        <Link
          href="/today"
          aria-label="Close"
          className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-sunken"
        >
          <X className="size-6" />
        </Link>
        <div
          role="group"
          aria-label="Meal"
          className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto py-1"
        >
          {MEAL_TYPES.map((t) => (
            <Chip key={t} selected={t === mealType} onClick={() => setMealType(t)}>
              {MEAL_LABEL[t]}
            </Chip>
          ))}
        </div>
      </div>

      <h1 className="mt-5 display text-[28px] leading-tight">What did you eat?</h1>

      <form
        suppressHydrationWarning
        id="type-meal"
        onSubmit={submit}
        className="mt-4 flex flex-col gap-2"
      >
        <label htmlFor="meal-text" className="sr-only">
          What did you eat?
        </label>
        <textarea
          suppressHydrationWarning
          id="meal-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setQueued(false);
          }}
          rows={5}
          maxLength={500}
          placeholder="2 roti, 1 katori dal, half katori bhindi, 1 cup chai with 1 sachet sugar"
          className="min-h-36 rounded-card border border-line-strong bg-surface p-4 text-[17px] leading-snug outline-none focus:border-ink"
        />
        <p className="flex gap-2 text-[13px] text-ink-3">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Add amounts for better numbers: pieces, katori, cups, grams or ml. Typing never uses a
          photo scan.
        </p>
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-brand">
            {error}
          </p>
        )}
        {queued && (
          <p role="status" className="text-[13px] font-semibold text-protein">
            Saved on this phone. We&apos;ll add it when you&apos;re back online.
          </p>
        )}
      </form>

      {usuals.length > 0 && (
        <section className="mt-6 flex flex-col gap-2" aria-labelledby="usuals-heading">
          <h2 id="usuals-heading" className="display text-[19px]">
            Your usuals
          </h2>
          <p className="-mt-1 text-[13px] text-ink-3">
            One tap adds it to {MEAL_LABEL[mealType].toLowerCase()}. No AI scan used.
          </p>
          <ul className="flex flex-col gap-2">
            {usuals.map((u) => (
              <li key={u.mealId}>
                <button
                  type="button"
                  onClick={() => relog(u)}
                  disabled={busy !== null}
                  className="flex min-h-16 w-full items-center gap-3 rounded-card bg-surface px-4 py-3 text-left disabled:opacity-60"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sunken text-ink-2">
                    <Repeat className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{mealTitle(u.names, "Meal")}</span>
                    <span className="text-[13px] text-ink-3 tabular-nums">
                      {formatInt(u.kcal)} kcal · P {u.proteinG} g
                      {u.count > 1 ? ` · logged ${u.count}×` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-brand">
                    {busy === u.mealId ? "Adding…" : "Add"}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <StickyFooter gutter={20} className="flex flex-col gap-4">
        <Button type="submit" form="type-meal" disabled={busy !== null}>
          {busy === "text" ? "Working it out…" : "Get calories"}
        </Button>
        <ModeTabs current="type" mealType={mealType} tone="light" />
      </StickyFooter>
    </main>
  );
}
