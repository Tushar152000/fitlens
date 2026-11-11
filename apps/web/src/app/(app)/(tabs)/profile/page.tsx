import { ChevronRight, Download, Flame, Pencil } from "lucide-react";
import Link from "next/link";
import { formatInt } from "@fitr8/domain/format";
import { requireOnboardedViewer, serverApi, serverApiOrNull } from "@/lib/server/api";
import type { DashboardDto, PlanDto, UsageDto } from "@fitr8/contracts";
import { DangerZone, PlanCard, Reminders, SignOutButton } from "./profile-controls";
import { apiUrl } from "@/lib/api-url";

export const metadata = { title: "Profile — FITR8" };

const GOAL_LABEL = {
  FAT_LOSS: "Lose fat",
  MUSCLE_GAIN: "Build muscle",
  RECOMPOSITION: "Recomposition",
} as const;
const DIET_LABEL = {
  VEG: "Veg",
  NON_VEG: "Non-veg",
  EGGETARIAN: "Eggetarian",
  VEGAN: "Vegan",
} as const;
const WHERE_LABEL = { FULL_GYM: "Gym", DUMBBELLS: "Home", BODYWEIGHT: "Anywhere" } as const;
const ACTIVITY_LABEL = {
  SEDENTARY: "Mostly sitting",
  LIGHT: "Lightly active",
  MODERATE: "Moderately active",
  VERY_ACTIVE: "Very active",
  ATHLETE: "Athlete",
} as const;

const date = (d: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(d));

/** Design 13: profile and settings. */
export default async function ProfilePage() {
  const { name, email, image, profile } = await requireOnboardedViewer();
  // /api/plan answers 404 until a goal and weigh-in exist; the screen then shows dashes.
  const [plan, day, usage] = await Promise.all([
    serverApiOrNull<PlanDto>("/plan"),
    serverApiOrNull<DashboardDto>("/dashboard"),
    serverApi<UsageDto>("/usage"),
  ]);
  const goal = plan?.goal ?? null;
  const target = plan?.summary.target ?? null;
  const metric = plan?.metric ?? null;
  const streak = day?.streak ?? 0;
  const goalLine = goal
    ? goal.targetBodyFatPct != null
      ? `${goal.targetBodyFatPct}% body fat by ${date(goal.targetDate)}`
      : goal.targetWeightKg != null
        ? `${goal.targetWeightKg} kg by ${date(goal.targetDate)}`
        : `Hold weight, improve shape by ${date(goal.targetDate)}`
    : "No active goal";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-4">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatar from the OAuth provider
          <img
            src={image}
            alt=""
            className="size-16 rounded-full bg-sunken"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="grid size-16 place-items-center rounded-full bg-ink display text-[24px] text-white">
            {(name ?? email ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate display text-[26px] leading-tight">{name ?? "Your profile"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-3">
            <span className="rounded-full bg-chip px-2.5 py-0.5 text-ink-2">Free plan</span>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1">
                <Flame className="size-4 fill-brand-glow text-brand-glow" aria-hidden />
                {streak}-day streak
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Desktop flows the cards into two balanced columns, keeping the phone order. */}
      <div className="flex flex-col gap-5 lg:block lg:columns-2 lg:gap-6 lg:[&>*]:mb-6 lg:[&>*]:break-inside-avoid">
        <section
          className="flex flex-col gap-3 rounded-card bg-ink p-5 text-white"
          aria-label="Current goal"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-white/70">Current goal</p>
              <p className="display text-[24px] leading-tight">
                {goal ? GOAL_LABEL[goal.type] : "—"}
              </p>
              <p className="text-[13px] text-white/75">{goalLine}</p>
            </div>
            <Link
              href="/onboarding"
              className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[13px] font-semibold hover:bg-white/15"
            >
              <Pencil className="size-4" aria-hidden />
              Edit
            </Link>
          </div>
          {target && (
            <p className="border-t border-white/15 pt-3 text-[13px] text-white/75 tabular-nums">
              <span className="font-bold text-white">{formatInt(target.kcal)} kcal</span> a day · P{" "}
              {target.proteinG} g · C {target.carbsG} g · F {target.fatG} g
            </p>
          )}
        </section>

        <Group title="Body">
          <Row label="Height" value={`${profile.heightCm} cm`} />
          <Row
            label="Weight"
            value={metric ? `${metric.weightKg} kg` : "—"}
            sub={metric ? `on ${date(metric.date)}` : undefined}
          />
          <Row
            label="Body fat"
            value={metric?.bodyFatPct != null ? `${Math.round(metric.bodyFatPct * 10) / 10}%` : "—"}
          />
          <Row label="Activity" value={ACTIVITY_LABEL[profile.activityLevel]} />
        </Group>

        <Group title="Food and training">
          <Row label="Diet" value={DIET_LABEL[profile.dietType]} />
          <Row label="Where I train" value={WHERE_LABEL[profile.equipment]} />
          <Row
            label="Sessions"
            value={`${profile.trainingDaysPerWeek} a week · ${profile.sessionMinutes} min`}
          />
          <Link
            href="/onboarding"
            className="flex min-h-12 items-center justify-between rounded-b-card px-4 font-semibold transition-colors hover:bg-sunken"
          >
            Edit body and training
            <ChevronRight className="size-5 text-ink-3" aria-hidden />
          </Link>
        </Group>

        <Group title="Reminders">
          <Reminders lunch={profile.remindLunch} dinner={profile.remindDinner} />
        </Group>

        <PlanCard usage={usage} />

        <Group title="Your data">
          <a
            href={apiUrl("/api/export")}
            className="flex min-h-12 items-center justify-between rounded-card px-4 font-semibold transition-colors hover:bg-sunken"
          >
            <span className="flex items-center gap-2">
              <Download className="size-5 text-ink-2" aria-hidden />
              Export as CSV
            </span>
            <ChevronRight className="size-5 text-ink-3" aria-hidden />
          </a>
        </Group>

        <div className="flex flex-col gap-5">
          <SignOutButton />
          <DangerZone />
        </div>
      </div>

      <p className="text-center text-[12px] text-ink-3">
        {email} · FITR8 gives general fitness guidance, not medical advice.
      </p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="display text-[19px]">{title}</h2>
      <div className="flex flex-col divide-y divide-line rounded-card bg-surface">{children}</div>
    </section>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-[15px] text-ink-2">{label}</span>
      <span className="text-right">
        <span className="font-semibold tabular-nums">{value}</span>
        {sub && <span className="block text-[12px] text-ink-3">{sub}</span>}
      </span>
    </div>
  );
}
