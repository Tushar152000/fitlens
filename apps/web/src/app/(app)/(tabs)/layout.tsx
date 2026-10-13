import { redirect } from "next/navigation";
import { requireOnboardedViewer } from "@/lib/server/api";

/**
 * The web shows signed-in users a read-only /home (docs/WEBSITE.md §4); logging and the full
 * dashboard live in the phone app. The tab screens below stay in the repo but aren't reachable
 * on the web: unfinished onboarding still goes to /onboarding first.
 */
export default async function TabsLayout() {
  await requireOnboardedViewer();
  redirect("/home");
}
