import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Signed-in user + profile for server components, deduped per request. Redirects to /login when signed out. */
export const requireViewer = cache(async () => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  return {
    userId: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    profile,
    timezone: profile?.timezone ?? "Asia/Kolkata",
  };
});

/** Like requireViewer, but also sends users who haven't finished onboarding to /onboarding. */
export async function requireOnboardedViewer() {
  const viewer = await requireViewer();
  if (!viewer.profile?.onboardedAt) redirect("/onboarding");
  return { ...viewer, profile: viewer.profile };
}
