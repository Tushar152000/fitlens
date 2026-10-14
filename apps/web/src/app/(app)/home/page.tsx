import { ChevronRight, Download, Flame, Pencil } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { GetAppCard } from "@/components/onboarding/get-app";
import { storeLinks } from "@/components/store-links";
import { dateLabel } from "@/components/onboarding/steps-meta";
import { cn } from "@/lib/cn";
import { formatInt } from "@fitr8/domain/format";
import { requireOnboardedViewer, serverApiOrNull } from "@/lib/server/api";
import type { DashboardDto, PlanDto, WaterDayDto } from "@fitr8/contracts";
import { DangerZone, SignOutButton } from "../(tabs)/profile/profile-controls";

export const metadata = { title: "Your plan — FITR8" };

const GOAL_LABEL = {
  FAT_LOSS: "Lose fat",
  MUSCLE_GAIN: "Build muscle",
  RECOMPOSITION: "Recomposition",
} as const;

/**
 * What a signed-in user sees on the web (docs/WEBSITE.md §4): their plan and today's numbers,
 * read-only, plus where to get the app. Logging happens in the phone app.
 */
export default async function HomePage() {
  const { name, email, timezone } = await requireOnboardedViewer();
  const [plan, day, water] = await Promise.all([
    serverApiOrNull<PlanDto>("/plan"),
    serverApiOrNull<DashboardDto>("/dashboard"),
    serverApiOrNull<WaterDayDto>("/water"),
  ]);
  const first = name?.split(" ")[0];
  const display = name ?? email ?? "You";
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(new Date());

  return (
    <div className="min-h-dvh bg-fitr8-soft">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-2" aria-label="FITR8 home">
          <LogoMark size={32} />
          <span className="text-[21px] font-extrabold tracking-[-0.02em]">
            FIT<span className="text-fitr8">R8</span>
          </span>
        </Link>
        <span className="flex items-center gap-2.5 text-sm font-semibold">
          <span className="hidden sm:inline">{display}</span>
          <span className="grid size-9 place-items-center rounded-full bg-fitr8-ink text-sm text-white">
            {display.charAt(0).toUpperCase()}
          </span>
        </span>
      </header>

      <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-5 pb-16 lg:px-10">
        <div>
          <p className="text-[13px] font-semibold text-ink-3">{today}</p>
          <h1 className="mt-1 text-[32px] leading-[1.1] font-semibold tracking-[-0.025em] lg:text-[40px]">
            Hi{first ? `, ${first}` : ""}
          </h1>
          <p className="mt-2 max-w-[38em] text-ink-2">
            Here’s your plan at a glance.{" "}
            {storeLinks().live
              ? "Log meals, water and workouts in the FITR8 app; your numbers show up here too."
              : "Logging happens in the FITR8 app, coming soon to iPhone and Android."}
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-6">
            {day?.target && <TodayCard day={day} water={water} />}
            {plan && <PlanSummary plan={plan} />}
          </div>

          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3" aria-labelledby="app-heading">
              <h2 id="app-heading" className="text-xl font-semibold tracking-[-0.02em]">
                {storeLinks().live ? "Log in the app" : "The app is coming soon"}
              </h2>
              <GetAppCard email={email} />
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="account-heading">
              <h2 id="account-heading" className="text-xl font-semibold tracking-[-0.02em]">
                Account
              </h2>
              <div className="flex flex-col divide-y divide-line rounded-[20px] bg-white">
                <div className="px-4 py-3.5">
                  <p className="font-semibold">{display}</p>
                  {email && <p className="text-sm text-ink-3">{email}</p>}
                </div>
                <AccountLink href="/onboarding" icon={<Pencil className="size-5 text-ink-2" />}>
                  Edit my plan
                </AccountLink>
                <AccountLink
                  href="/api/export"
                  icon={<Download className="size-5 text-ink-2" />}
                  plain
                >
                  Export my data (CSV)
                </AccountLink>
              </div>
              <SignOutButton />
              <DangerZone />
            </section>
          </div>
        </div>

        <p className="text-center text-xs text-ink-3">
          FITR8 gives general fitness guidance, not medical advice.
        </p>
      </main>
    </div>
  );
}

/** Today so far: calories, protein and water against target. Read-only. */
function TodayCard({ day, water }: { day: DashboardDto; water: WaterDayDto | null }) {
  const t = day.target!;
  const rows = [
    { label: "Calories", value: day.eaten.kcal, target: t.kcal, unit: "kcal", fill: "bg-fitr8" },
    {
      label: "Protein",
      value: day.eaten.proteinG,
      target: t.proteinG,
      unit: "g",
      fill: "bg-protein",
    },
    ...(water
      ? [
          {
            label: "Water",
            value: water.consumedMl / 1000,
            target: water.targetMl / 1000,
            unit: "L",
            fill: "bg-water",
            decimals: 1,
          },
        ]
      : []),
  ];
  const left = t.kcal - day.eaten.kcal;
  return (
    <section className="rounded-[20px] bg-white p-5 lg:p-6" aria-labelledby="today-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="today-heading" className="text-xl font-semibold tracking-[-0.02em]">
          Today so far
        </h2>
        {day.streak > 0 && (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums">
            <Flame className="size-4 fill-brand-glow text-brand-glow" aria-hidden />
            {day.streak}-day streak
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-2 tabular-nums">
        {left >= 0 ? `${formatInt(left)} kcal left` : `${formatInt(-left)} kcal over`} ·{" "}
        {day.meals.length === 0
          ? "nothing logged yet"
          : `${day.meals.length} ${day.meals.length === 1 ? "meal" : "meals"} logged`}
      </p>
      <dl className="mt-5 flex flex-col gap-4">
        {rows.map((r) => {
          const fmt = (n: number) => ("decimals" in r ? n.toFixed(1) : formatInt(n));
          return (
            <div key={r.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <dt className="font-semibold">{r.label}</dt>
                <dd className="font-semibold text-ink-2 tabular-nums">
                  {fmt(r.value)} / {fmt(r.target)} {r.unit}
                </dd>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-track" aria-hidden>
                <div
                  className={cn(
                    "h-full animate-bar-in rounded-full",
                    r.value > r.target && r.label === "Calories" ? "bg-fitr8-ink" : r.fill,
                  )}
                  style={{
                    width: `${Math.min(100, r.target > 0 ? (r.value / r.target) * 100 : 0)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** The saved plan: daily target and macros, goal, and training. */
function PlanSummary({ plan }: { plan: PlanDto }) {
  const { summary, goal, metric, training } = plan;
  const { kcal, proteinG, carbsG, fatG } = summary.target;
  const recomp = goal.type === "RECOMPOSITION";
  return (
    <section
      className="rounded-3xl bg-fitr8-ink p-5 text-white shadow-[6px_6px_0_var(--color-fitr8-deep)] lg:p-6"
      aria-labelledby="plan-heading"
    >
      <h2 id="plan-heading" className="text-[13px] font-semibold text-white/70">
        Your daily target
      </h2>
      <p className="mt-1.5 text-[52px] leading-none font-semibold tracking-[-0.035em] tabular-nums">
        {formatInt(kcal)} <span className="text-base tracking-normal text-white/70">kcal</span>
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-[13px]">
        {(
          [
            ["Protein", proteinG],
            ["Carbs", carbsG],
            ["Fat", fatG],
          ] as const
        ).map(([label, g]) => (
          <div key={label} className="flex flex-col-reverse">
            <dd className="text-[17px] font-semibold tabular-nums">{g} g</dd>
            <dt className="text-white/70">{label}</dt>
          </div>
        ))}
      </dl>
      <dl className="mt-5 grid gap-3 border-t border-white/15 pt-4 text-sm sm:grid-cols-3">
        <Fact label="Goal" value={GOAL_LABEL[goal.type]} />
        <Fact
          label={recomp ? "Weight" : "Weight now → goal"}
          value={
            recomp
              ? `${metric.weightKg} kg, holding`
              : `${metric.weightKg} → ${summary.plan.targetWeightKg} kg`
          }
          sub={`by ${dateLabel(goal.targetDate)}`}
        />
        <Fact
          label="Training"
          value={`${training.daysPerWeek}× a week`}
          sub={`${training.sessionMinutes} min sessions`}
        />
      </dl>
    </section>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-white/60">{label}</dt>
      <dd className="font-semibold tabular-nums">
        {value}
        {sub && <span className="block text-xs font-normal text-white/60">{sub}</span>}
      </dd>
    </div>
  );
}

function AccountLink({
  href,
  icon,
  plain,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  /** A download, not an in-app page. */
  plain?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    "flex min-h-12 items-center justify-between px-4 font-semibold transition-colors hover:bg-fitr8-soft";
  const inner = (
    <>
      <span className="flex items-center gap-2.5">
        {icon}
        {children}
      </span>
      <ChevronRight className="size-5 text-ink-3" aria-hidden />
    </>
  );
  return plain ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
