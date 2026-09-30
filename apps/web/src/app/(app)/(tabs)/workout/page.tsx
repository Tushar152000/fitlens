import { EnergySchema } from "@fitlens/contracts";
import { requireOnboardedViewer, serverApi } from "@/lib/server/api";
import type { TodayWorkoutDto } from "@fitlens/contracts";
import { WorkoutSession } from "./workout-session";

export const metadata = { title: "Workout — FitLens" };

/** Screen 10: today's session from the coach engine, with the energy check from 10a applied. */
export default async function WorkoutPage({ searchParams }: PageProps<"/workout">) {
  await requireOnboardedViewer();
  const sp = await searchParams;
  const energy = EnergySchema.catch("ok").parse(typeof sp.energy === "string" ? sp.energy : "ok");
  const data = await serverApi<TodayWorkoutDto>(`/workouts/today?energy=${energy}`);
  return <WorkoutSession data={data} energy={energy} />;
}
