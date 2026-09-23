import { localDate } from "@/lib/dates";
import { mockWeek } from "@/lib/mock/workout";
import { requireOnboardedViewer } from "@/lib/viewer";
import { WorkoutSession } from "./workout-session";

export const metadata = { title: "Workout — FitLens" };

/** Screen 9: today's session. Mock data until the workout plan API lands (roadmap week 4). */
export default async function WorkoutPage() {
  const { profile, timezone } = await requireOnboardedViewer();
  const week = mockWeek({
    today: localDate(timezone),
    equipment: profile.equipment,
    daysPerWeek: profile.trainingDaysPerWeek,
    sessionMinutes: profile.sessionMinutes,
  });
  return <WorkoutSession {...week} equipment={profile.equipment} />;
}
