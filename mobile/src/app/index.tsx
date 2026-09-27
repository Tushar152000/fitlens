import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";

/** Entry: send the user to the right place for their sign-in and onboarding state. */
export default function Index() {
  const { status, me } = useAuth();
  if (status !== "signedIn") return <Redirect href="/login" />;
  return <Redirect href={me.onboarded ? "/today" : "/onboarding"} />;
}
