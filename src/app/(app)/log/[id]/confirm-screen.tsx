"use client";

import { ChevronLeft, CircleAlert, NotebookPen, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button, MealItemEditor, Switch } from "@/components/ui";
import { api, ApiError } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatInt, MEAL_LABEL, sentenceCase, type MealType } from "@/lib/format";
import {
  fromItems,
  rowFromFood,
  scaleRow,
  toConfirmPayload,
  totals,
  type ItemDto,
  type Row,
} from "./rows";

export interface MealDto {
  id: string;
  mealType: MealType;
  source: "PHOTO" | "TEXT";
  status: "PENDING" | "ANALYZING" | "READY" | "CONFIRMED" | "FAILED";
  inputText: string | null;
  aiNotes: string | null;
  aiRaw: { hiddenFatLikely?: boolean } | null;
  error: string | null;
  photoUrl: string | null;
  items: ItemDto[];
}

interface FoodHit {
  id: string;
  name: string;
  per100g: { kcal: number; protein: number; carbs: number; fat: number };
  units: { unit: string; grams: number }[];
}

const POLL_MS = 1000;
const POLL_GIVE_UP_MS = 60_000;

export function ConfirmScreen({ initial }: { initial: MealDto }) {
  const router = useRouter();
  const [meal, setMeal] = useState(initial);
  const [rows, setRows] = useState<Row[]>(() => fromItems(initial.items).rows);
  const [ghee, setGhee] = useState(() =>
    initial.status === "CONFIRMED"
      ? fromItems(initial.items).ghee
      : Boolean(initial.aiRaw?.hiddenFatLikely) || fromItems(initial.items).ghee,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [slow, setSlow] = useState(false);

  const analysing = meal.status === "PENDING" || meal.status === "ANALYZING";

  // Poll while the worker analyses; hydrate the editor once when results arrive.
  useEffect(() => {
    if (!analysing) return;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      try {
        const next = await api<MealDto>(`/api/meals/${meal.id}`);
        if (stopped) return;
        if (next.status !== "PENDING" && next.status !== "ANALYZING") {
          const parsed = fromItems(next.items);
          setRows(parsed.rows);
          setGhee(Boolean(next.aiRaw?.hiddenFatLikely) || parsed.ghee);
          setMeal(next);
          return;
        }
      } catch {
        // transient; keep polling
      }
      if (Date.now() - started > POLL_GIVE_UP_MS) return setSlow(true);
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [analysing, meal.id]);

  const sum = totals(rows, ghee);
  const mealLabel = MEAL_LABEL[meal.mealType].toLowerCase();
  const manual = meal.source === "TEXT" && !meal.inputText;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/meals/${meal.id}`, { method: "PUT", json: toConfirmPayload(rows, ghee) });
      router.push("/today");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this meal?")) return;
    try {
      await api(`/api/meals/${meal.id}`, { method: "DELETE" });
      router.push("/today");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete. Try again.");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header meal={meal} />

      <main className="flex flex-1 flex-col px-5 pt-5">
        {analysing ? (
          <Analysing slow={slow} />
        ) : meal.status === "FAILED" ? (
          <Failed meal={meal} />
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <h1 className="display text-[26px] leading-tight">
                {rows.length === 0
                  ? "Add what you ate"
                  : manual
                    ? `${rows.length} ${rows.length === 1 ? "item" : "items"}`
                    : `We found ${rows.length} ${rows.length === 1 ? "item" : "items"}`}
              </h1>
              <button
                type="button"
                onClick={remove}
                aria-label="Delete meal"
                className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:text-ink"
              >
                <Trash2 className="size-5" />
              </button>
            </div>
            {meal.aiNotes && !manual && (
              <p className="mt-1 text-[13px] text-ink-3">{meal.aiNotes}</p>
            )}
            {rows.length > 0 && !manual && (
              <p className="mt-1 text-[13px] text-ink-3">Check portions — tap − or + to adjust.</p>
            )}

            <div className="mt-4 flex flex-col gap-2.5">
              {rows.map((row, i) => (
                <MealItemEditor
                  key={row.key}
                  item={row}
                  onQuantityChange={(q) =>
                    setRows((all) => all.map((r, j) => (j === i ? scaleRow(r, q) : r)))
                  }
                  onRemove={() => setRows((all) => all.filter((_, j) => j !== i))}
                />
              ))}
              <Button variant="dashed" onClick={() => setAddOpen(true)}>
                <Plus className="size-5" aria-hidden />
                {rows.length ? "Add a missed item" : "Add an item"}
              </Button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 rounded-card bg-surface p-4">
              <div className="flex flex-col">
                <span id="ghee-label" className="font-semibold">
                  Cooked with ghee or oil
                </span>
                <span className="text-[13px] text-ink-3 tabular-nums">
                  +45 kcal · +5 g fat (1 tsp)
                </span>
              </div>
              <Switch checked={ghee} onChange={setGhee} labelledBy="ghee-label" />
            </div>

            <div className="sticky bottom-0 z-20 -mx-5 mt-auto bg-gradient-to-t from-ground from-75% to-transparent px-5 pt-6 pb-[max(16px,env(safe-area-inset-bottom))]">
              <div className="mb-3 flex items-end justify-between rounded-card bg-surface px-4 py-3">
                <div>
                  <p className="text-[12px] font-semibold text-ink-3">Total</p>
                  <p className="display text-[26px] leading-none tabular-nums" aria-live="polite">
                    {formatInt(sum.kcal)}{" "}
                    <span className="text-[13px] font-semibold text-ink-3">kcal</span>
                  </p>
                </div>
                <p className="flex gap-3 text-[13px] font-semibold tabular-nums">
                  <span className="text-protein">P {formatInt(sum.proteinG)} g</span>
                  <span className="text-carbs-text">C {formatInt(sum.carbsG)} g</span>
                  <span className="text-fat">F {formatInt(sum.fatG)} g</span>
                </p>
              </div>
              {error && (
                <p role="alert" className="mb-3 text-center text-[13px] font-semibold text-brand">
                  {error}
                </p>
              )}
              <Button onClick={save} disabled={saving || rows.length === 0}>
                {saving ? "Saving…" : `Save to ${mealLabel}`}
              </Button>
            </div>
          </>
        )}
      </main>

      <AddItemSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(row) => {
          setRows((all) => [...all, row]);
          setAddOpen(false);
        }}
      />
    </div>
  );
}

function Header({ meal }: { meal: MealDto }) {
  const back = (
    <Link
      href="/today"
      aria-label="Back to today"
      className={cn(
        "grid size-11 place-items-center rounded-full",
        meal.photoUrl ? "bg-ink/55 text-white backdrop-blur" : "text-ink hover:bg-sunken",
      )}
    >
      <ChevronLeft className="size-6" />
    </Link>
  );
  if (meal.photoUrl) {
    return (
      <div className="relative h-56 shrink-0 overflow-hidden bg-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
        <img
          src={meal.photoUrl}
          alt={`Your ${MEAL_LABEL[meal.mealType].toLowerCase()} photo`}
          className="size-full object-cover"
        />
        <div className="absolute top-3 left-3">{back}</div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 pt-3">
      {back}
      <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ink-3">
        <NotebookPen className="size-4 shrink-0" aria-hidden />
        <span className="truncate">
          {MEAL_LABEL[meal.mealType]}
          {meal.inputText ? ` · “${meal.inputText}”` : ""}
        </span>
      </div>
    </div>
  );
}

function Analysing({ slow }: { slow: boolean }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2.5">
      <h1 className="display text-[26px]">Reading your plate…</h1>
      <p className="text-[13px] text-ink-3">
        {slow
          ? "This is taking longer than usual. You can leave — it'll be on Today when ready."
          : "Usually a few seconds."}
      </p>
      <div className="mt-2 flex flex-col gap-2.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex animate-[shimmer_1.2s_ease-in-out_infinite] flex-col gap-3 rounded-card bg-surface p-4"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <span className="h-4 w-2/5 rounded-full bg-track" />
            <span className="h-3 w-1/4 rounded-full bg-track" />
            <div className="flex justify-between">
              <span className="h-11 w-32 rounded-input bg-sunken" />
              <span className="h-4 w-16 self-center rounded-full bg-track" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Failed({ meal }: { meal: MealDto }) {
  const notFood = meal.error?.includes("doesn't look like food");
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-3 rounded-card bg-surface p-5">
        <CircleAlert className="mt-0.5 size-6 shrink-0 text-ink-2" aria-hidden />
        <div>
          <h1 className="text-lg font-bold">
            {notFood ? "We couldn't spot any food" : "We couldn't read this one"}
          </h1>
          <p className="mt-1 text-ink-2">
            {notFood
              ? "Try a photo from above with the whole plate in frame, or just type what you ate."
              : "Something went wrong on our side. Typing it usually works."}
          </p>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-3 pt-8 pb-[max(16px,env(safe-area-inset-bottom))]">
        <Button asChild>
          <Link href={`/log?meal=${meal.mealType}&mode=text`}>Type it instead</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/log?meal=${meal.mealType}`}>Try another photo</Link>
        </Button>
      </div>
    </div>
  );
}

function AddItemSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (row: Row) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<FoodHit | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/foods?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setHits((await res.json()).foods);
      } catch {
        // aborted or offline
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const close = () => {
    setPicked(null);
    setQ("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={picked ? sentenceCase(picked.name) : "Add an item"}>
      {picked ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-[13px] font-semibold text-ink-2">Pick a portion</p>
          {picked.units.map((u) => {
            const row = rowFromFood(picked, u);
            return (
              <button
                key={u.unit}
                type="button"
                onClick={() => {
                  onAdd(row);
                  setPicked(null);
                  setQ("");
                }}
                className="flex min-h-14 items-center justify-between rounded-input border border-line-strong px-4 text-left hover:border-ink-3"
              >
                <span className="font-semibold">
                  1 {u.unit}{" "}
                  <span className="font-medium text-ink-3">· {formatInt(u.grams)} g</span>
                </span>
                <span className="font-bold tabular-nums">{formatInt(row.kcal)} kcal</span>
              </button>
            );
          })}
          <Button variant="secondary" onClick={() => setPicked(null)}>
            Back to search
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex h-[52px] items-center gap-2 rounded-input border border-line-strong bg-surface px-4 focus-within:border-ink">
            <Search className="size-5 shrink-0 text-ink-3" aria-hidden />
            <label htmlFor="food-search" className="sr-only">
              Search foods
            </label>
            <input
              id="food-search"
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search roti, dal, paneer…"
              autoComplete="off"
              className="w-full bg-transparent text-base outline-none"
            />
          </div>
          <ul className="flex max-h-[45dvh] flex-col overflow-y-auto" aria-busy={loading}>
            {hits.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setPicked(f)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-line py-2 text-left"
                >
                  <span className="font-semibold">{sentenceCase(f.name)}</span>
                  <span className="text-[13px] text-ink-3 tabular-nums">
                    {formatInt(f.per100g.kcal)} kcal / 100 g
                  </span>
                </button>
              </li>
            ))}
            {!loading && hits.length === 0 && (
              <li className="py-4 text-center text-[13px] text-ink-3">
                No match in our food list yet. Try another name.
              </li>
            )}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
