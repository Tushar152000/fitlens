import { requireViewer } from "@/lib/server/api";
import { FinishSignup } from "./finish-signup";

export const metadata = { title: "Building your plan — FITR8" };

/** Landing spot after Google from the welcome flow: saves the stashed answers, then the plan. */
export default async function WelcomeDonePage() {
  const viewer = await requireViewer();
  return <FinishSignup onboarded={Boolean(viewer.profile?.onboardedAt)} />;
}
