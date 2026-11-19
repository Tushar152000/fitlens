import { requireViewer, serverApiOrNull } from "@/lib/server/api";
import type { PlanDto } from "@fitr8/contracts";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import type { OnboardingDraft } from "@/lib/onboarding/draft";
import { splitName, splitPhone } from "@fitr8/domain/person";

export const metadata = { title: "Set up your plan | FITR8" };

const ymd = (d: string) => d.slice(0, 10);
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

/**
 * Signed-in onboarding: first time ("new", straight after Google at /login) or to
 * change the goal from Profile ("edit", prefilled from the profile).
 */
export default async function OnboardingPage() {
  const viewer = await requireViewer();
  const { profile } = viewer;
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
        medicalNote: profile.medicalNote ?? "",
      }
    : {};

  // Step 1 ("new" only): what the account already knows; Google's full name is split in two.
  // The dev sign-in names accounts after the email, which isn't worth prefilling.
  const realName = viewer.name && viewer.name !== viewer.email?.split("@")[0] ? viewer.name : null;
  const phone = splitPhone(viewer.phone);
  const initialPerson = {
    ...splitName(realName, viewer.lastName),
    phoneCountry: phone.country,
    phone: phone.national,
  };

  return (
    <OnboardingFlow
      mode={profile?.onboardedAt ? "edit" : "new"}
      initial={initial}
      initialPerson={initialPerson}
    />
  );
}
