"use client";

import {
  Check,
  ChevronRight,
  Clock,
  Dumbbell,
  ListOrdered,
  TrendingUp,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import type { TodayWorkoutDto } from "@fitr8/contracts";
import type { Energy } from "@fitr8/domain/training";

type SetState = { kg: string; reps: string; done: boolean };

const weekday = (ymd: string, style: "long" | "narrow" = "long") =>
  new Intl.DateTimeFormat("en-IN", { weekday: style, timeZone: "UTC" }).format(new Date(ymd));

const repsLabel = (e: { repMin: number; repMax: number; timed: boolean }) =>
  `${e.repMin}–${e.repMax}${e.timed ? " s" : ""}`;

export function WorkoutSession({ data, energy }: { data: TodayWorkoutDto; energy: Energy }) {
  const session = data.session;
  const [active, setActive] = useState(0);
  const [sets, setSets] = useState<SetState[][]>(
    () =>
      session?.exercises.map((e) =>
        Array.from({ length: e.sets }, () => ({
          kg: e.targetKg != null ? String(e.targetKg) : "",
          reps: "",
          done: data.completed.includes(e.slug),
        })),
      ) ?? [],
  );
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const doneCount = sets.filter((s) => s.length && s.every((x) => x.done)).length;
  const allDone = session != null && doneCount === session.exercises.length;

  function update(i: number, patch: Partial<SetState>) {
    setSets((all) =>
      all.map((ex, j) =>
        j === active ? ex.map((s, k) => (k === i ? { ...s, ...patch } : s)) : ex,
      ),
    );
  }

  async function toggle(i: number) {
    if (!session) return;
    const ex = session.exercises[active];
    const current = sets[active];
    const nowDone = !current[i].done;
    const reps = current[i].reps || String(ex.repMax);
    const next = current.map((s, k) => (k === i ? { ...s, done: nowDone, reps } : s));
    setSets((all) => all.map((e, j) => (j === active ? next : e)));
    if (!nowDone || !next.every((s) => s.done)) return;

    // Last set of this exercise ticked: log it and show next time's target.
    setError(null);
    try {
      const res = await api<{ next: { note: string } }>("/api/workouts/logs", {
        method: "POST",
        json: {
          planId: data.planId,
          exerciseSlug: ex.slug,
          sets: next.map((s) => ({
            kg: s.kg.trim() === "" ? null : Number(s.kg),
            reps: Math.round(Number(s.reps) || 0),
            rir: ex.rir,
          })),
        },
      });
      setSaved((m) => ({ ...m, [ex.slug]: res.next.note }));
      const nextOpen = session.exercises.findIndex(
        (_, j) => j > active && !sets[j]?.every((s) => s.done),
      );
      if (nextOpen > 0) setActive(nextOpen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that exercise. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[13px] font-semibold text-ink-3">
          {session ? "Today's session" : "Rest day"} · {data.split}
          {data.deload ? " · deload week" : ""}
        </p>
        <h1 className="display text-[28px] leading-tight">
          {session ? session.name : "Recover today"}
        </h1>
      </header>

      <ol className="grid grid-cols-7 gap-1.5" aria-label="This week">
        {data.strip.map((d) => (
          <li
            key={d.date}
            aria-label={`${weekday(d.date)}: ${d.name ?? "rest"}, ${d.state}`}
            aria-current={d.state === "today" ? "date" : undefined}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 rounded-input text-[12px] font-bold",
              d.state === "today" && "bg-ink text-white",
              d.state === "done" && "bg-protein-soft text-protein",
              d.state === "planned" && "border border-line-strong bg-surface text-ink",
              d.state === "missed" &&
                "border border-dashed border-line-strong bg-surface text-ink-3",
              (d.state === "rest" || d.state === "before") && "bg-sunken text-ink-3",
            )}
          >
            {weekday(d.date, "narrow")}
            {d.state === "done" ? (
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
            ) : (
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  d.state === "rest" ? "bg-transparent" : "bg-current",
                )}
              />
            )}
          </li>
        ))}
      </ol>

      {!session ? (
        <RestDay data={data} />
      ) : (
        <>
          <ul className="flex flex-wrap gap-2" aria-label="Session details">
            {[
              { icon: Clock, text: `~${session.estimatedMinutes} min` },
              { icon: ListOrdered, text: `${session.exercises.length} exercises` },
              { icon: Dumbbell, text: `energy: ${energy}` },
            ].map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-chip px-4 text-sm font-semibold text-ink-2"
              >
                <Icon className="size-4" aria-hidden /> {text}
              </li>
            ))}
          </ul>

          <ActiveExercise
            ex={session.exercises[active]}
            index={active}
            total={session.exercises.length}
            doneCount={doneCount}
            sets={sets[active]}
            saved={saved[session.exercises[active].slug]}
            onChange={update}
            onToggle={toggle}
          />
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-brand">
              {error}
            </p>
          )}

          {allDone && (
            <div className="flex gap-3 rounded-card bg-protein-soft p-4">
              <Utensils className="mt-0.5 size-5 shrink-0 text-protein" aria-hidden />
              <div className="flex flex-col gap-2">
                <p className="font-bold">Session done. Protein next.</p>
                <p className="text-[13px] text-ink-2">
                  Aim for 25–40 g of protein at your next meal to help recovery.
                </p>
                <Link href="/log/type" className="text-[13px] font-semibold text-brand">
                  Log your next meal
                </Link>
              </div>
            </div>
          )}

          <section className="flex flex-col gap-2" aria-labelledby="exercises-heading">
            <h2 id="exercises-heading" className="display text-[19px]">
              Exercises
            </h2>
            <ul className="flex flex-col gap-2">
              {session.exercises.map((e, i) => {
                const done = sets[i]?.every((s) => s.done);
                return (
                  <li key={e.slug}>
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      aria-current={i === active ? "step" : undefined}
                      className={cn(
                        "flex min-h-14 w-full items-center gap-3 rounded-card bg-surface px-4 py-3 text-left",
                        i === active && "outline-2 outline-ink",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-bold",
                          done ? "bg-protein text-white" : "bg-sunken text-ink-2",
                        )}
                      >
                        {done ? (
                          <Check className="size-4" strokeWidth={3} aria-label="Done" />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold">{e.name}</span>
                        <span className="text-[13px] text-ink-3 tabular-nums">
                          {e.sets} × {repsLabel(e)}
                          {e.targetKg != null ? ` · ${e.targetKg} kg` : ""} · {e.rir} in reserve
                        </span>
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function ActiveExercise({
  ex,
  index,
  total,
  doneCount,
  sets,
  saved,
  onChange,
  onToggle,
}: {
  ex: NonNullable<TodayWorkoutDto["session"]>["exercises"][number];
  index: number;
  total: number;
  doneCount: number;
  sets: SetState[];
  saved?: string;
  onChange: (i: number, patch: Partial<SetState>) => void;
  onToggle: (i: number) => void;
}) {
  const weighted = ex.targetKg != null;
  return (
    <section
      className="flex flex-col gap-3 rounded-card bg-surface p-4"
      aria-labelledby="active-exercise"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-ink-3">
            {ex.role === "main"
              ? "Main lift"
              : ex.role === "secondary"
                ? "Second lift"
                : "Accessory"}{" "}
            · exercise {index + 1} of {total}
          </p>
          <h2 id="active-exercise" className="display text-[22px] leading-tight">
            {ex.name}
          </h2>
          <p className="text-[13px] text-ink-2 tabular-nums">
            {ex.sets} × {repsLabel(ex)} · {ex.rir} reps in reserve · rest{" "}
            {Math.round((ex.restSec / 60) * 2) / 2} min
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-sunken px-2.5 py-1 text-[12px] font-bold tabular-nums">
          {doneCount}/{total} done
        </span>
      </div>

      <table className="w-full text-left">
        <thead>
          <tr className="text-[12px] font-semibold text-ink-3">
            <th className="w-10 pb-1 font-semibold">Set</th>
            <th className="pb-1 font-semibold">{weighted ? "kg" : "Load"}</th>
            <th className="pb-1 font-semibold">{ex.timed ? "Seconds" : "Reps"}</th>
            <th className="w-12 pb-1 text-right font-semibold">
              <span className="sr-only">Done</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s, i) => (
            <tr key={i} className={cn(s.done && "text-ink-3")}>
              <td className="py-1 text-[15px] font-bold tabular-nums">{i + 1}</td>
              <td className="py-1 pr-2">
                {weighted ? (
                  <SetInput
                    label={`Set ${i + 1} kg`}
                    value={s.kg}
                    onChange={(kg) => onChange(i, { kg })}
                  />
                ) : (
                  <span className="text-[13px] font-semibold text-ink-3">Bodyweight</span>
                )}
              </td>
              <td className="py-1 pr-2">
                <SetInput
                  label={`Set ${i + 1} ${ex.timed ? "seconds" : "reps"}`}
                  value={s.reps}
                  placeholder={repsLabel(ex)}
                  onChange={(reps) => onChange(i, { reps })}
                />
              </td>
              <td className="py-1 text-right">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={s.done}
                  aria-label={`Set ${i + 1} done`}
                  onClick={() => onToggle(i)}
                  className={cn(
                    "inline-grid size-11 place-items-center rounded-input transition-colors duration-150",
                    s.done ? "bg-protein text-white" : "bg-sunken text-ink-3 hover:text-ink",
                  )}
                >
                  <Check className="size-5" strokeWidth={2.5} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {ex.bonusRep && (
        <p className="text-[13px] font-semibold text-protein">
          Feeling great: take one extra rep on your last set.
        </p>
      )}

      <p className="flex gap-2 rounded-input bg-protein-soft p-3 text-[13px] text-ink-2">
        <TrendingUp className="mt-0.5 size-4 shrink-0 text-protein" aria-hidden />
        {saved
          ? `Saved. Next time: ${saved}`
          : (ex.note ??
            `Stop each set with ${ex.rir} good reps left. Top the range on every set and the load goes up.`)}
      </p>
    </section>
  );
}

function RestDay({ data }: { data: TodayWorkoutDto }) {
  return (
    <>
      <p className="rounded-card bg-surface p-4 text-ink-2">{data.cardio}</p>
      {data.nextDay && (
        <section className="flex flex-col gap-2" aria-labelledby="next-heading">
          <h2 id="next-heading" className="display text-[19px]">
            Next: {data.nextDay.name}, {weekday(data.nextDay.date)}
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-card bg-surface">
            {data.nextDay.exercises.map((e) => (
              <li key={e.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-semibold">{e.name}</span>
                <span className="text-[13px] text-ink-3 tabular-nums">
                  {e.sets} × {repsLabel(e)}
                  {e.targetKg != null ? ` · ${e.targetKg} kg` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Button asChild variant="secondary">
        <Link href="/workout/brief">Coach briefing</Link>
      </Button>
    </>
  );
}

function SetInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      suppressHydrationWarning
      aria-label={label}
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(",", "."))}
      className="h-11 w-full min-w-0 rounded-input bg-sunken px-3 text-[15px] font-semibold tabular-nums outline-none placeholder:text-ink-3/70 focus:ring-2 focus:ring-ink"
    />
  );
}
