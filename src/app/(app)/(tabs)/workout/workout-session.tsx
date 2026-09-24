"use client";

import { Check, ChevronRight, Clock, Dumbbell, ListOrdered, TrendingUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Equipment, MockSession, WeekDay } from "@/lib/mock/workout";

const EQUIPMENT_LABEL: Record<Equipment, string> = {
  FULL_GYM: "Full gym",
  DUMBBELLS: "Dumbbells",
  BODYWEIGHT: "No equipment",
};

type SetState = { kg: string; reps: string; done: boolean };

export function WorkoutSession({
  week,
  session,
  isTrainingDay,
  nextDay,
  equipment,
}: {
  week: WeekDay[];
  session: MockSession;
  isTrainingDay: boolean;
  nextDay: WeekDay | null;
  equipment: Equipment;
}) {
  const [active, setActive] = useState(0);
  const [sets, setSets] = useState<SetState[][]>(() =>
    session.exercises.map((e) =>
      e.sets.map((s) => ({
        kg: s.kg == null ? "" : String(s.kg),
        reps: String(s.reps),
        done: false,
      })),
    ),
  );

  const exercise = session.exercises[active];
  const current = sets[active];
  const doneCount = sets.filter((s) => s.every((x) => x.done)).length;

  const update = (i: number, patch: Partial<SetState>) =>
    setSets((all) =>
      all.map((ex, j) =>
        j === active ? ex.map((s, k) => (k === i ? { ...s, ...patch } : s)) : ex,
      ),
    );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[13px] font-semibold text-ink-3">
          {isTrainingDay ? "Today's session" : "Rest day"}
        </p>
        <h1 className="display text-[28px] leading-tight">
          {isTrainingDay ? session.name : "Recover today"}
        </h1>
      </header>

      <ol className="grid grid-cols-7 gap-1.5" aria-label="This week">
        {week.map((d) => (
          <li
            key={d.date}
            aria-label={`${new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(new Date(d.date))}: ${d.isToday && d.state === "rest" ? "today, rest" : d.state}`}
            aria-current={d.isToday ? "date" : undefined}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 rounded-input text-[12px] font-bold",
              d.state === "today" && "bg-ink text-white",
              d.state === "done" && "bg-protein-soft text-protein",
              d.state === "planned" && "border border-line-strong bg-surface text-ink",
              d.state === "rest" && "bg-sunken text-ink-3",
              d.isToday && d.state === "rest" && "ring-2 ring-ink ring-inset",
            )}
          >
            {d.letter}
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

      <ul className="flex flex-wrap gap-2" aria-label="Session details">
        {[
          { icon: Clock, text: `${session.minutes} min` },
          { icon: ListOrdered, text: `${session.exercises.length} exercises` },
          { icon: Dumbbell, text: EQUIPMENT_LABEL[equipment] },
        ].map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-chip px-4 text-sm font-semibold text-ink-2"
          >
            <Icon className="size-4" aria-hidden /> {text}
          </li>
        ))}
      </ul>

      {!isTrainingDay && (
        <p className="rounded-card bg-surface p-4 text-ink-2">
          No session today. A 20–30 minute walk helps recovery.
          {nextDay &&
            ` Next session is ${new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(new Date(nextDay.date))} — here's a preview.`}
        </p>
      )}

      <section
        className="flex flex-col gap-3 rounded-card bg-surface p-4"
        aria-labelledby="active-exercise"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold text-ink-3">
              {exercise.muscleGroup} · exercise {active + 1} of {session.exercises.length}
            </p>
            <h2 id="active-exercise" className="display text-[22px] leading-tight">
              {exercise.name}
            </h2>
          </div>
          <span className="shrink-0 rounded-full bg-sunken px-2.5 py-1 text-[12px] font-bold tabular-nums">
            {doneCount}/{session.exercises.length} done
          </span>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="text-[12px] font-semibold text-ink-3">
              <th className="w-10 pb-1 font-semibold">Set</th>
              <th className="pb-1 font-semibold">{exercise.sets[0]?.kg == null ? "Load" : "kg"}</th>
              <th className="pb-1 font-semibold">
                {exercise.slug === "plank" ? "Seconds" : "Reps"}
              </th>
              <th className="w-12 pb-1 text-right font-semibold">
                <span className="sr-only">Done</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {current.map((s, i) => (
              <tr key={i} className={cn(s.done && "text-ink-3")}>
                <td className="py-1 text-[15px] font-bold tabular-nums">{i + 1}</td>
                <td className="py-1 pr-2">
                  {exercise.sets[i].kg == null ? (
                    <span className="text-[13px] font-semibold text-ink-3">Bodyweight</span>
                  ) : (
                    <SetInput
                      label={`Set ${i + 1} kg`}
                      value={s.kg}
                      onChange={(kg) => update(i, { kg })}
                    />
                  )}
                </td>
                <td className="py-1 pr-2">
                  <SetInput
                    label={`Set ${i + 1} reps`}
                    value={s.reps}
                    onChange={(reps) => update(i, { reps })}
                  />
                </td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={s.done}
                    aria-label={`Set ${i + 1} done`}
                    onClick={() => update(i, { done: !s.done })}
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

        <p className="flex gap-2 rounded-input bg-protein-soft p-3 text-[13px] text-ink-2">
          <TrendingUp className="mt-0.5 size-4 shrink-0 text-protein" aria-hidden />
          {exercise.hint}
        </p>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="remaining-heading">
        <h2 id="remaining-heading" className="display text-[19px]">
          Exercises
        </h2>
        <ul className="flex flex-col gap-2">
          {session.exercises.map((e, i) => {
            const done = sets[i].every((s) => s.done);
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
                    {done ? <Check className="size-4" strokeWidth={3} aria-label="Done" /> : i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{e.name}</span>
                    <span className="text-[13px] text-ink-3 tabular-nums">
                      {e.sets.length} × {e.sets[0].reps}
                      {e.sets[0].kg != null ? ` · ${e.sets[0].kg} kg` : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-center text-[12px] text-ink-3">
          Sample session — personalised plans that progress each week are coming soon.
        </p>
      </section>
    </div>
  );
}

function SetInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      suppressHydrationWarning
      aria-label={label}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(",", "."))}
      className="h-11 w-full min-w-0 rounded-input bg-sunken px-3 text-[15px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ink"
    />
  );
}
