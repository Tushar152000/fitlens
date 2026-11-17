import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";

/** Entry: send the user to the right place for their sign-in and onboarding state. */
export default function Index() {
  const { status, me } = useAuth();
  if (status !== "signedIn") return <Redirect href="/login" />;
  if (!me.onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href={me.welcomeBack ? "/welcome-back" : "/today"} />;
}
