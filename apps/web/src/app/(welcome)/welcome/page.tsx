import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { currentUser } from "@/lib/server/api";
import { signInProviders } from "@/lib/server/providers";

export const metadata: Metadata = { title: "Build your plan — FITR8" };

/**
 * "Start for free": name, goal, body, training, then Google. Answers wait in sessionStorage
 * until /welcome/done saves them. Signed-in visitors go straight to their next step.
 */
export default async function WelcomePage() {
  const [me, providers] = await Promise.all([currentUser(), signInProviders()]);
  if (me) redirect(me.onboarded ? "/home" : "/onboarding");
  return <OnboardingFlow mode="welcome" providers={providers} />;
}
