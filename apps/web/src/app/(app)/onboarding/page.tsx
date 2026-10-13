import { requireViewer, serverApiOrNull } from "@/lib/server/api";
import type { PlanDto } from "@fitr8/contracts";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import type { OnboardingDraft } from "@/lib/onboarding/draft";

export const metadata = { title: "Set up your plan — FITR8" };

const ymd = (d: string) => d.slice(0, 10);
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

/**
 * Signed-in onboarding: first time ("new", e.g. after /login without the welcome flow) or to
 * change the goal from Profile ("edit", prefilled from the profile).
 */
export default async function OnboardingPage() {
  const { profile } = await requireViewer();
  // GET /api/plan carries the active goal and latest weigh-in; 404 until onboarding has saved them.
  const plan = profile ? await serverApiOrNull<PlanDto>("/plan") : null;
  const metric = plan?.metric ?? null;
  const goal = plan?.goal ?? null;

  const initial: Partial<OnboardingDraft> = profile
    ? {
        goalType: goal?.type,
        targetMode: goal?.targetBodyFatPct != null ? "BODY_FAT" : "WEIGHT",
        targetWeightKg: str(goal?.targetWeightKg),
        targetBodyFatPct: str(goal?.targetBodyFatPct),
        targetDate: goal ? ymd(goal.targetDate) : undefined,
        sex: profile.sex,
        birthDate: ymd(profile.birthDate),
        heightCm: str(profile.heightCm),
        weightKg: str(metric?.weightKg),
        waistCm: str(metric?.waistCm),
        neckCm: str(metric?.neckCm),
        hipCm: str(metric?.hipCm),
        activityLevel: profile.activityLevel,
        dietType: profile.dietType,
        experience: profile.experience,
        equipment: profile.equipment,
        trainingDaysPerWeek: profile.trainingDaysPerWeek,
        sessionMinutes: profile.sessionMinutes,
        injuries: profile.injuries.join(", "),
        medicalFlag: profile.medicalFlag,
      }
    : {};

  return <OnboardingFlow mode={profile?.onboardedAt ? "edit" : "new"} initial={initial} />;
}
