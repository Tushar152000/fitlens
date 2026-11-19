import { redirect } from "next/navigation";

/** Where Google used to return after the old /welcome flow. /home routes to the plan or onboarding. */
export default function WelcomeDonePage() {
  redirect("/home");
}
