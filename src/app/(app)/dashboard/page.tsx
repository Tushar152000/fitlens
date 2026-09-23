import { auth } from "@/auth";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getDay } from "@/lib/services/dashboard";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile?.onboardedAt) {
    // Onboarding UI is next on the roadmap; the API is ready at POST /api/onboarding.
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Welcome, {session!.user!.name ?? "there"}</h1>
        <p className="text-neutral-500">
          Onboarding comes next. Your goal and targets will show here.
        </p>
      </div>
    );
  }

  const day = await getDay(userId, localDate(profile.timezone));
  if (!day.target) return <p className="text-neutral-500">No targets yet. Re-run onboarding.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Today</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Calories" eaten={day.eaten.kcal} target={day.target.kcal} unit="kcal" />
        <Stat label="Protein" eaten={day.eaten.proteinG} target={day.target.proteinG} unit="g" />
        <Stat label="Carbs" eaten={day.eaten.carbsG} target={day.target.carbsG} unit="g" />
        <Stat label="Fat" eaten={day.eaten.fatG} target={day.target.fatG} unit="g" />
      </div>
      <p className="text-neutral-500">{day.meals.length} meals logged today.</p>
    </div>
  );
}

function Stat({
  label,
  eaten,
  target,
  unit,
}: {
  label: string;
  eaten: number;
  target: number;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="text-xl font-semibold">
        {Math.round(eaten)}{" "}
        <span className="text-sm font-normal text-neutral-500">
          / {target} {unit}
        </span>
      </div>
    </div>
  );
}
