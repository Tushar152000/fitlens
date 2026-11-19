import { redirect } from "next/navigation";

/**
 * The old "Start for free" flow (answers first, Google last). Everyone now starts at /login:
 * Google first, then members go to their plan and new people to /onboarding. Kept for old links.
 */
export default function WelcomePage() {
  redirect("/login");
}
