import { ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/auth";
import { Button } from "@/components/ui";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatInt } from "@/lib/format";
import { currentTarget } from "@/lib/services/targets";
import { requireOnboardedViewer } from "@/lib/viewer";

export const metadata = { title: "Profile — FitLens" };

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

export default async function ProfilePage() {
  const { userId, name, email, image, profile, timezone } = await requireOnboardedViewer();
  const [goal, target] = await Promise.all([
    prisma.goal.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }),
    currentTarget(userId, localDate(timezone)),
  ]);
  const byDate =
    goal &&
    new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(goal.targetDate);
  const goalDetail = goal
    ? goal.targetBodyFatPct != null
      ? `${goal.targetBodyFatPct}% body fat by ${byDate}`
      : goal.targetWeightKg != null
        ? `${goal.targetWeightKg} kg by ${byDate}`
        : `by ${byDate}`
    : "No active goal";

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex items-center gap-4">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatar from the OAuth provider
          <img
            src={image}
            alt=""
            className="size-14 rounded-full bg-sunken"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="grid size-14 place-items-center rounded-full bg-ink display text-[22px] text-white">
            {(name ?? email ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate display text-[26px] leading-tight">{name ?? "Your profile"}</h1>
          {email && <p className="truncate text-[13px] text-ink-3">{email}</p>}
        </div>
      </header>

      <dl className="flex flex-col divide-y divide-line rounded-card bg-surface">
        <Row label="Goal" value={goal ? GOAL_LABEL[goal.type] : "—"} sub={goalDetail} />
        <Row
          label="Daily target"
          value={target ? `${formatInt(target.kcal)} kcal` : "—"}
          sub={
            target
              ? `P ${target.proteinG} g · C ${target.carbsG} g · F ${target.fatG} g`
              : undefined
          }
        />
        <Row label="Diet" value={DIET_LABEL[profile.dietType]} />
        <Row
          label="Training"
          value={`${profile.trainingDaysPerWeek} days a week`}
          sub={`${profile.sessionMinutes} min sessions`}
        />
      </dl>

      <Link
        href="/onboarding"
        className="flex min-h-14 items-center justify-between rounded-card bg-surface px-4 font-semibold"
      >
        Change goal or details
        <ChevronRight className="size-5 text-ink-3" aria-hidden />
      </Link>

      <form
        className="mt-auto"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="secondary">
          <LogOut className="size-5" aria-hidden />
          Sign out
        </Button>
      </form>
      <p className="text-center text-[12px] text-ink-3">
        FitLens gives general fitness guidance, not medical advice.
      </p>
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <dt className="text-[13px] font-semibold text-ink-3">{label}</dt>
      <dd className="text-right">
        <span className="font-semibold">{value}</span>
        {sub && <span className="block text-[13px] text-ink-3">{sub}</span>}
      </dd>
    </div>
  );
}
