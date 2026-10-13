import Link from "next/link";
import { MealRow } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatInt, formatTime, MEAL_LABEL, type MealType } from "@fitr8/domain/format";
import { requireOnboardedViewer, serverApi } from "@/lib/server/api";
import type { HistoryDayDto, HistoryDto } from "@fitr8/contracts";

export const metadata = { title: "History — FITR8" };

const dayLabel = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(new Date(ymd));

/** Design 12: 7/30-day intake history with a tappable day list. */
export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const { timezone } = await requireOnboardedViewer();
  const params = await searchParams;
  const days = params.days === "30" ? 30 : 7;
  const h = await serverApi<HistoryDto>(`/history?days=${days}`);
  const selected = h.days.find((d) => d.date === params.day) ?? h.days[h.days.length - 1];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[13px] font-semibold text-ink-3">Meal history</p>
        <h1 className="display text-[28px] leading-tight">History</h1>
      </header>

      <nav aria-label="Range" className="flex rounded-input bg-chip p-1">
        {([7, 30] as const).map((n) => (
          <Link
            key={n}
            href={`/history?days=${n}`}
            aria-current={n === days ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-[11px] text-[15px] font-semibold transition-colors",
              n === days ? "bg-surface text-ink shadow-seg" : "text-ink-2 hover:text-ink",
            )}
          >
            {n} days
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-2" aria-label="Summary">
        <div className="flex flex-col rounded-card bg-surface p-3">
          <span className="text-[12px] font-semibold text-ink-3">Average on full days</span>
          <span className="display text-[22px] tabular-nums">
            {h.avgKcalFullDays == null ? "—" : formatInt(h.avgKcalFullDays)}
            {h.avgKcalFullDays != null && (
              <span className="text-[13px] font-semibold text-ink-3"> kcal</span>
            )}
          </span>
        </div>
        <div className="flex flex-col rounded-card bg-surface p-3">
          <span className="text-[12px] font-semibold text-ink-3">Days logged</span>
          <span className="display text-[22px] tabular-nums">
            {h.daysLogged}
            <span className="text-[13px] font-semibold text-ink-3"> of {days}</span>
          </span>
        </div>
      </section>

      <DailyBars days={h.days} range={days} selected={selected.date} />

      <section className="flex flex-col gap-2.5" aria-labelledby="day-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="day-heading" className="display text-[19px]">
            {selected.isToday
              ? "Today"
              : dayLabel(selected.date, { weekday: "long", day: "numeric", month: "short" })}
          </h2>
          <span className="text-[13px] font-semibold text-ink-3 tabular-nums">
            {formatInt(selected.kcal)}
            {selected.target ? ` / ${formatInt(selected.target)}` : ""} kcal
          </span>
        </div>
        {selected.meals.length ? (
          selected.meals.map((m) => (
            <MealRow
              key={m.id}
              href={`/log/${m.id}`}
              meta={`${MEAL_LABEL[m.mealType as MealType]} · ${formatTime(m.createdAt, timezone)}`}
              title={m.title}
              kcal={m.kcal}
            />
          ))
        ) : (
          <p className="rounded-card bg-surface p-4 text-ink-3">Nothing logged this day.</p>
        )}
      </section>
    </div>
  );
}

/** Brand = within target, ink = over, grey stub = not logged, faded = today so far; dashed target line. */
function DailyBars({
  days,
  range,
  selected,
}: {
  days: HistoryDayDto[];
  range: number;
  selected: string;
}) {
  const targets = days.map((d) => d.target ?? 0);
  const max = Math.max(...days.map((d) => d.kcal), ...targets, 1) * 1.1;
  const typicalTarget = targets.filter(Boolean).at(-1) ?? 0;
  const over = days.filter((d) => d.logged && d.target && d.kcal > d.target).length;
  const summary = `${days.filter((d) => d.logged).length} of ${range} days logged; ${over} over target. Target ${formatInt(typicalTarget)} kcal.`;
  const height = 150;

  return (
    <section className="rounded-card bg-surface p-4" aria-label="Daily calories">
      <p className="sr-only">{summary}</p>
      <div className="relative" style={{ height }}>
        {typicalTarget > 0 && (
          <div
            aria-hidden
            className="absolute inset-x-0 border-t-2 border-dashed border-ink-3/60"
            style={{ bottom: (typicalTarget / max) * height }}
          >
            <span className="absolute -top-5 right-0 text-[11px] font-semibold text-ink-3 tabular-nums">
              {formatInt(typicalTarget)}
            </span>
          </div>
        )}
        <ol className={cn("absolute inset-0 flex items-end", range === 7 ? "gap-3" : "gap-[3px]")}>
          {days.map((d) => {
            const isOver = d.logged && d.target != null && d.kcal > d.target;
            const h = d.logged ? Math.max(6, (d.kcal / max) * height) : 6;
            return (
              <li key={d.date} className="flex h-full flex-1 items-end">
                <Link
                  href={`/history?days=${range}&day=${d.date}`}
                  aria-current={d.date === selected ? "date" : undefined}
                  aria-label={`${dayLabel(d.date, { weekday: "long", day: "numeric", month: "short" })}: ${
                    d.logged
                      ? `${formatInt(d.kcal)} kcal${d.isToday ? " so far" : ""}${isOver ? ", over target" : ""}`
                      : "not logged"
                  }`}
                  className="flex h-full w-full items-end justify-center rounded-t-md outline-offset-2"
                >
                  <span
                    className={cn(
                      "w-full rounded-t-md transition-[height] duration-200",
                      !d.logged ? "bg-line" : isOver ? "bg-ink" : "bg-brand",
                      d.isToday && d.logged && "opacity-45",
                      d.date === selected && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
                    )}
                    style={{ height: h }}
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
      {range === 7 && (
        <ol
          aria-hidden
          className="mt-2 flex gap-3 text-center text-[11px] font-semibold text-ink-3"
        >
          {days.map((d) => (
            <li key={d.date} className="flex-1">
              {dayLabel(d.date, { weekday: "narrow" })}
            </li>
          ))}
        </ol>
      )}
      <p
        aria-hidden
        className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-ink-3"
      >
        <Legend className="bg-brand" label="Within target" />
        <Legend className="bg-ink" label="Over" />
        <Legend className="bg-line" label="Not logged" />
        <Legend className="bg-brand opacity-45" label="Today so far" />
      </p>
    </section>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm", className)} />
      {label}
    </span>
  );
}
