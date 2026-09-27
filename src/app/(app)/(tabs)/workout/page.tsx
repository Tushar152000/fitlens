import { localDate } from "@/lib/dates";
import { getTodayWorkout } from "@/lib/services/workouts";
import { requireOnboardedViewer } from "@/lib/viewer";
import { EnergySchema } from "@/lib/validators";
import { WorkoutSession } from "./workout-session";

export const metadata = { title: "Workout — FitLens" };

/** Screen 10: today's session from the coach engine, with the energy check from 10a applied. */
export default async function WorkoutPage({ searchParams }: PageProps<"/workout">) {
  const { userId, timezone } = await requireOnboardedViewer();
  const sp = await searchParams;
  const energy = EnergySchema.catch("ok").parse(typeof sp.energy === "string" ? sp.energy : "ok");
  const data = await getTodayWorkout(userId, localDate(timezone), energy);
  return <WorkoutSession data={data} energy={energy} />;
}
