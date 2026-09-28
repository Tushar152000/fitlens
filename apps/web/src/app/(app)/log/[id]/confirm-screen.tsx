"use client";

import {
  Camera,
  Check,
  ChevronLeft,
  CircleAlert,
  NotebookPen,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AiLimitSheet, type ScanUsage } from "@/components/ai-limit-sheet";
import type { FoodHitDto, MealDetailDto, ParsedItemDto } from "@fitlens/contracts";
import { Sheet } from "@/components/sheet";
import { Button, MealItemEditor, Switch } from "@/components/ui";
import { api, ApiError } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatInt, MEAL_LABEL, sentenceCase, type MealType } from "@fitlens/domain/format";
import {
  fromItems,
  rowFromFood,
  scaleRow,
  setRowGrams,
  toConfirmPayload,
  totals,
  type Row,
} from "./rows";

/** GET /api/meals/:id, with the one hint the screen reads from the model's raw output. */
export type MealDto = Omit<MealDetailDto, "aiRaw"> & {
  aiRaw: { hiddenFatLikely?: boolean } | null;
};

type FoodHit = FoodHitDto;

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
  const [note, setNote] = useState(initial.note ?? "");
  const [rechecking, setRechecking] = useState(false);
  // Design 8 → 9: after a live analysis, show "Found N items" until the user taps Review.
  const [found, setFound] = useState(false);
  const [limit, setLimit] = useState<ScanUsage | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);

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
          if (next.status === "READY" && parsed.rows.length) setFound(true);
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

  // Ghee/oil only makes sense for cooked food, not a coffee or a shake.
  const gheeRelevant = rows.length === 0 || rows.some((r) => !r.isLiquid);
  const withGhee = ghee && gheeRelevant;
  const sum = totals(rows, withGhee);
  const mealLabel = MEAL_LABEL[meal.mealType].toLowerCase();
  const manual = meal.source === "TEXT" && !meal.inputText;
  const saved = meal.status === "CONFIRMED";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/meals/${meal.id}`, {
        method: "PUT",
        json: toConfirmPayload(rows, withGhee, note),
      });
      router.push("/today");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
      setSaving(false);
    }
  }

  /**
   * Run the AI again: with the Details note, or as a plain retry after an error (design 9b).
   * Polling picks up the result.
   */
  async function recheck(withNote = true) {
    setRechecking(true);
    setError(null);
    const body = withNote && note.trim() ? { note: note.trim() } : {};
    try {
      await api(`/api/meals/${meal.id}/recheck`, { method: "POST", json: body });
      setSlow(false);
      setMeal((m) => ({ ...m, status: "PENDING", error: null, note: body.note ?? m.note }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && e.details) {
        setLimit(e.details as ScanUsage);
        setLimitOpen(true);
      } else {
        setError(e instanceof Error ? e.message : "Couldn't re-check. Try again.");
      }
    } finally {
      setRechecking(false);
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
      <Header meal={meal} scanning={analysing} />

      <main className="flex flex-1 flex-col px-5 pt-5">
        {analysing ? (
          <Analysing slow={slow} mealType={meal.mealType} hasPhoto={Boolean(meal.photoUrl)} />
        ) : meal.status === "FAILED" ? (
          <Failed
            meal={meal}
            onRetry={() => recheck(false)}
            retrying={rechecking}
            error={error}
            onDelete={remove}
          />
        ) : found ? (
          <Found count={rows.length} onReview={() => setFound(false)} />
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <h1 className="display text-[26px] leading-tight">
                {saved
                  ? `Edit ${mealLabel}`
                  : rows.length === 0
                    ? "Add what you ate"
                    : manual
                      ? `${rows.length} ${rows.length === 1 ? "item" : "items"}`
                      : `We found ${rows.length} ${rows.length === 1 ? "item" : "items"}`}
              </h1>
              <button
                type="button"
                onClick={remove}
                className="-mr-2 flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-3 hover:bg-sunken hover:text-ink"
              >
                <Trash2 className="size-4" aria-hidden />
                Delete
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
                  onAmountChange={(g) =>
                    setRows((all) => all.map((r, j) => (j === i ? setRowGrams(r, g) : r)))
                  }
                  onRemove={() => setRows((all) => all.filter((_, j) => j !== i))}
                />
              ))}
              <Button variant="dashed" onClick={() => setAddOpen(true)}>
                <Plus className="size-5" aria-hidden />
                {rows.length ? "Add a missed item" : "Add an item"}
              </Button>
            </div>

            {gheeRelevant && (
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
            )}

            <div className="mt-3 flex flex-col gap-2.5 rounded-card bg-surface p-4">
              <label htmlFor="meal-note" className="font-semibold">
                Details
              </label>
              <textarea
                suppressHydrationWarning
                id="meal-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="e.g. small cup, 2 sachets sugar, full-cream milk"
                className="rounded-input border border-line-strong bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-ink"
              />
              <p className="text-[13px] text-ink-3">
                Saved with the meal. Re-check to let the AI correct the items using your details.
              </p>
              <Button
                variant="secondary"
                onClick={() => recheck(true)}
                disabled={rechecking || note.trim().length < 2}
              >
                <Sparkles className="size-5" aria-hidden />
                {rechecking ? "Re-checking…" : "Re-check with details"}
              </Button>
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
                {saving ? "Saving…" : saved ? "Save changes" : `Save to ${mealLabel}`}
              </Button>
            </div>
          </>
        )}
      </main>

      <AiLimitSheet
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        mealType={meal.mealType}
        usage={limit}
      />

      <AddItemSheet
        open={addOpen}
        mealType={meal.mealType}
        onClose={() => setAddOpen(false)}
        onAdd={(added) => {
          setRows((all) => [...all, ...added]);
          setAddOpen(false);
        }}
      />
    </div>
  );
}

function Header({ meal, scanning }: { meal: MealDto; scanning: boolean }) {
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
        {scanning && (
          // Design 8: animated scan line; hidden under reduced motion.
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-0.5 animate-[scan_1.6s_ease-in-out_infinite_alternate] bg-brand-glow shadow-[0_0_16px_4px_rgb(232_119_46_/_0.6)] motion-reduce:hidden"
          />
        )}
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

const STEP_MS = 2500;

/** Design 8: 3-step checklist + skeleton rows while the AI works. */
function Analysing({
  slow,
  mealType,
  hasPhoto,
}: {
  slow: boolean;
  mealType: MealType;
  hasPhoto: boolean;
}) {
  // Steps 2 and 3 are paced by time: the API only reports "analysing", not sub-steps.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 500), 500);
    return () => clearInterval(t);
  }, []);
  const steps = [
    hasPhoto ? "Photo uploaded" : "Meal received",
    "Finding the foods",
    "Estimating portions",
  ];
  const active = elapsed < STEP_MS ? 1 : 2;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="display text-[26px]">Reading your plate…</h1>
      <ol className="mt-4 flex flex-col gap-2.5" aria-live="polite">
        {steps.map((label, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full",
                  done
                    ? "bg-protein text-white"
                    : current
                      ? "border-2 border-brand"
                      : "border-2 border-line-strong",
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                ) : current ? (
                  <span className="size-2 animate-pulse rounded-full bg-brand" />
                ) : null}
              </span>
              <span
                className={cn(
                  "text-[15px]",
                  done ? "text-ink-2" : current ? "font-semibold" : "text-ink-3",
                )}
              >
                {label}
                <span className="sr-only">
                  {done ? " — done" : current ? " — in progress" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex flex-col gap-2.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex animate-[shimmer_1.2s_ease-in-out_infinite] flex-col gap-3 rounded-card bg-surface p-4"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <span className="h-4 w-2/5 rounded-full bg-sunken" />
            <span className="h-3 w-1/4 rounded-full bg-sunken" />
            <div className="flex justify-between">
              <span className="h-11 w-32 rounded-input bg-sunken" />
              <span className="h-4 w-16 self-center rounded-full bg-sunken" />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-auto pt-6 pb-[max(16px,env(safe-area-inset-bottom))] text-center text-[13px] text-ink-3">
        {slow ? "This is taking longer than usual. " : "Taking too long? "}
        <Link
          href={`/log/type?meal=${mealType}`}
          className="font-semibold text-brand underline-offset-2 hover:underline"
        >
          Type it instead
        </Link>
      </p>
    </div>
  );
}

/** Design 8 → 9 hand-off: results are in; one tap to review them. */
function Found({ count, onReview }: { count: number; onReview: () => void }) {
  return (
    <div className="flex flex-1 flex-col" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-protein text-white">
          <Check className="size-5" strokeWidth={3} aria-hidden />
        </span>
        <h1 className="display text-[26px]">
          Found {count} {count === 1 ? "item" : "items"}
        </h1>
      </div>
      <p className="mt-2 text-ink-2">Check the portions before saving — you can change anything.</p>
      <div className="mt-auto pt-8 pb-[max(16px,env(safe-area-inset-bottom))]">
        <Button onClick={onReview}>
          Review {count} {count === 1 ? "item" : "items"}
        </Button>
      </div>
    </div>
  );
}

/** Design 9b: two variants — not food (no scan used) and our error (photo kept, retry). */
function Failed({
  meal,
  onRetry,
  retrying,
  error,
  onDelete,
}: {
  meal: MealDto;
  onRetry: () => void;
  retrying: boolean;
  error: string | null;
  onDelete: () => void;
}) {
  const notFood = meal.error?.includes("doesn't look like food");
  const typeHref = `/log/type?meal=${meal.mealType}`;
  return (
    <div className="flex flex-1 flex-col">
      {notFood ? (
        <>
          <h1 className="display text-[26px] leading-tight">We couldn&apos;t spot any food</h1>
          <p className="mt-1 text-ink-2">This doesn&apos;t count toward your daily scans.</p>
          <div className="mt-4 flex flex-col gap-2.5 rounded-card bg-surface p-4">
            <p className="font-semibold">For a better read</p>
            <ul className="flex flex-col gap-2 text-[15px] text-ink-2">
              {[
                "Shoot from above, whole plate in frame",
                "Use daylight or a bright room, no flash glare",
                "One plate or bowl per photo",
              ].map((tip) => (
                <li key={tip} className="flex gap-2">
                  <Check className="mt-1 size-4 shrink-0 text-protein" aria-hidden />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <>
          <h1 className="display text-[26px] leading-tight">We couldn&apos;t read this one</h1>
          <div className="mt-3 flex gap-3 rounded-card bg-surface p-4">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-ink-2" aria-hidden />
            <p className="text-ink-2">
              <span className="font-semibold text-ink">Your photo is saved.</span> Something went
              wrong on our side — try again, or type it.
            </p>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[13px] font-semibold text-brand">
          {error}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-3 pt-8 pb-[max(16px,env(safe-area-inset-bottom))]">
        {notFood ? (
          <Button asChild>
            <Link href={`/log?meal=${meal.mealType}`}>
              <Camera className="size-5" aria-hidden />
              Retake photo
            </Link>
          </Button>
        ) : (
          <Button onClick={onRetry} disabled={retrying}>
            <RotateCw className="size-5" aria-hidden />
            {retrying ? "Trying again…" : "Try again"}
          </Button>
        )}
        <Button asChild variant="secondary">
          <Link href={typeHref}>Type it instead</Link>
        </Button>
        <button
          type="button"
          onClick={onDelete}
          className="mx-auto flex min-h-11 items-center gap-1.5 px-3 text-[13px] font-semibold text-ink-3 hover:text-ink"
        >
          <Trash2 className="size-4" aria-hidden />
          Delete this meal
        </button>
      </div>
    </div>
  );
}

type ParsedItem = ParsedItemDto;

function AddItemSheet({
  open,
  mealType,
  onClose,
  onAdd,
}: {
  open: boolean;
  mealType: MealType;
  onClose: () => void;
  onAdd: (rows: Row[]) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<FoodHit | null>(null);
  const [describing, setDescribing] = useState(false);
  const [describeError, setDescribeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const text = q.trim();

  /** Free text ("2 sachets sugar") → priced items via the AI, for things the list search misses. */
  async function describe() {
    setDescribing(true);
    setDescribeError(null);
    try {
      const { items } = await api<{ items: ParsedItem[] }>("/api/meals/parse-items", {
        method: "POST",
        json: { text, mealType },
      });
      if (!items.length) {
        setDescribeError("That doesn't sound like food or a drink. Try wording it differently.");
        return;
      }
      onAdd(
        items.map((i, n) => ({
          key: `ai-${Date.now()}-${n}`,
          foodId: i.foodId,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          grams: i.grams,
          kcal: i.kcal,
          proteinG: i.proteinG,
          carbsG: i.carbsG,
          fatG: i.fatG,
          confidence: i.aiConfidence,
          approximate: i.approximate,
          isLiquid: i.isLiquid,
        })),
      );
      setQ("");
    } catch (e) {
      setDescribeError(e instanceof Error ? e.message : "Couldn't add that. Try again.");
    } finally {
      setDescribing(false);
    }
  }

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
                  onAdd([row]);
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
              suppressHydrationWarning
              id="food-search"
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setDescribeError(null);
              }}
              placeholder="Search sugar, roti, dal…"
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
                No match in our food list. Describe it below instead.
              </li>
            )}
          </ul>
          {text.length >= 2 ? (
            <Button
              variant={hits.length === 0 && !loading ? "primary" : "secondary"}
              onClick={describe}
              disabled={describing}
            >
              <Sparkles className="size-5" aria-hidden />
              {describing ? "Working it out…" : `Add “${text}”`}
            </Button>
          ) : (
            <p className="text-[13px] text-ink-3">
              Or describe it, like “2 sachets sugar” or “half cup milk”.
            </p>
          )}
          {describeError && (
            <p role="alert" className="text-[13px] font-semibold text-brand">
              {describeError}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
