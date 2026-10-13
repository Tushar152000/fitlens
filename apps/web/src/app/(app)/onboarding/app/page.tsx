import { Bell, Camera, CircleCheck, Footprints } from "lucide-react";
import { GetAppCard } from "@/components/onboarding/get-app";
import { OnboardingShell } from "@/components/onboarding/shell";
import { estimateLine, parseMode, RAIL, SETUP_STEPS } from "@/components/onboarding/steps-meta";
import { requireOnboardedViewer, serverApiOrNull } from "@/lib/server/api";
import type { PlanDto } from "@fitr8/contracts";

export const metadata = { title: "Get the app — FITR8" };

const PERKS = [
  {
    icon: Camera,
    title: "Snap meals with your camera",
    sub: "Photo, voice, barcode and label scans",
  },
  {
    icon: Bell,
    title: "Reminders that know your day",
    sub: "Water, lunch, dinner and workout nudges",
  },
  { icon: Footprints, title: "Steps counted for you", sub: "From Health Connect or Apple Health" },
];

/**
 * The end of onboarding: send people to the phone app (QR on desktop, a deep link on phones).
 * There's deliberately no "continue on the web" here; the plan is saved to the account, so the
 * app just needs a sign-in.
 */
export default async function GetTheAppPage({ searchParams }: PageProps<"/onboarding/app">) {
  const [{ name }, sp, plan] = await Promise.all([
    requireOnboardedViewer(),
    searchParams,
    serverApiOrNull<PlanDto>("/plan"),
  ]);
  // Straight after the welcome flow the rail shows its seven steps; otherwise the signed-in five.
  const mode = parseMode(sp.flow) === "welcome" ? "welcome" : "new";
  const rail = RAIL[mode];
  const first = name?.split(" ")[0];
  const t = plan?.summary.target;

  return (
    <OnboardingShell
      steps={rail}
      current={rail.indexOf("Get the app")}
      setupSteps={SETUP_STEPS[mode]}
      wide
      estimate={
        t && plan
          ? {
              ...t,
              exact: true,
              line: estimateLine({
                goalType: plan.goal.type,
                exact: true,
                targetWeightKg: plan.summary.plan.targetWeightKg,
                targetDate: plan.goal.targetDate,
              }),
            }
          : null
      }
    >
      <p className="flex items-center gap-2.5 rounded-2xl bg-protein-soft px-3.5 py-3 text-sm font-semibold text-protein">
        <CircleCheck className="size-[18px] shrink-0" strokeWidth={2.6} aria-hidden />
        Your plan is saved{first ? `, ${first}` : ""}. It’s waiting for you in the app.
      </p>
      <div>
        <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.025em] lg:text-[38px]">
          Take FITR8 with you
        </h1>
        <p className="mt-2 text-ink-2">
          Logging works best on your phone: snap a meal in two seconds, get reminders, and count
          your steps. Sign in with the same Google account and everything’s there.
        </p>
      </div>

      <div className="grid items-center gap-5 lg:grid-cols-2">
        <div>
          <GetAppCard />
        </div>

        <ul className="grid gap-2.5">
          {PERKS.map(({ icon: Icon, title, sub }) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl bg-white p-3.5">
              <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-fitr8-lilac-soft text-fitr8">
                <Icon className="size-[19px]" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="text-[13px] text-ink-3">{sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </OnboardingShell>
  );
}
