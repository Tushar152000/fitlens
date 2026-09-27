import { localDate } from "@/lib/dates";
import { getTodayWorkout } from "@/lib/services/workouts";
import { requireOnboardedViewer } from "@/lib/viewer";
import { EnergySchema } from "@/lib/validators";
import { Briefing } from "./briefing";

export const metadata = { title: "Coach briefing — FitLens" };

/** Design 10a: fuel, energy check, today's rules and prescriptions before the session. */
export default async function BriefPage({ searchParams }: PageProps<"/workout/brief">) {
  const { userId, timezone } = await requireOnboardedViewer();
  const sp = await searchParams;
  const energy = EnergySchema.catch("ok").parse(typeof sp.energy === "string" ? sp.energy : "ok");
  const data = await getTodayWorkout(userId, localDate(timezone), energy);
  return <Briefing data={data} energy={energy} />;
}
