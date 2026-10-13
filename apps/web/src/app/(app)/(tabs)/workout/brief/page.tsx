import { EnergySchema } from "@fitr8/contracts";
import { requireOnboardedViewer, serverApi } from "@/lib/server/api";
import type { TodayWorkoutDto } from "@fitr8/contracts";
import { Briefing } from "./briefing";

export const metadata = { title: "Coach briefing — FITR8" };

/** Design 10a: fuel, energy check, today's rules and prescriptions before the session. */
export default async function BriefPage({ searchParams }: PageProps<"/workout/brief">) {
  await requireOnboardedViewer();
  const sp = await searchParams;
  const energy = EnergySchema.catch("ok").parse(typeof sp.energy === "string" ? sp.energy : "ok");
  const data = await serverApi<TodayWorkoutDto>(`/workouts/today?energy=${energy}`);
  return <Briefing data={data} energy={energy} />;
}
