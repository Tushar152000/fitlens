import { prisma } from "@/lib/db";
import { requireViewer } from "@/lib/viewer";
import { OnboardingForm, type OnboardingDraft } from "./onboarding-form";

export const metadata = { title: "Set up your plan — FitLens" };

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

/** Three-step onboarding. Prefills from an existing profile so users can re-run it to change their goal. */
export default async function OnboardingPage() {
  const { userId, profile } = await requireViewer();
  const [metric, goal] = profile
    ? await Promise.all([
        prisma.bodyMetric.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
        prisma.goal.findFirst({
          where: { userId, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [null, null];

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

  return <OnboardingForm initial={initial} returning={Boolean(profile?.onboardedAt)} />;
}
