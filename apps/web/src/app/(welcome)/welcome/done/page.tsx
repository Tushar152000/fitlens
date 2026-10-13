import { requireViewer } from "@/lib/server/api";
import { SaveName } from "./save-name";

export const metadata = { title: "Setting up — FITR8" };

/** Landing spot after sign-in from the welcome flow: saves the stashed name, then moves on. */
export default async function WelcomeDonePage() {
  const viewer = await requireViewer();
  return <SaveName onboarded={Boolean(viewer.profile?.onboardedAt)} />;
}
