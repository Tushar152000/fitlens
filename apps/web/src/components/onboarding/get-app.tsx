import { Smartphone } from "lucide-react";
import { onboardingButton } from "./button-styles";

/** The app's deep link (apps/mobile app.json "scheme"); opens Today when the app is installed. */
export const APP_LINK = "fitlens://today";

/**
 * The phone app isn't in the stores yet: say it's coming, and that the plan will be waiting. Phones
 * keep an "Open the FITR8 app" deep link for beta testers who already have it installed.
 */
export function GetAppCard() {
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-hard">
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-fitr8-lilac-soft text-fitr8">
          <Smartphone className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold">The FITR8 app is coming soon</p>
          <p className="mt-1 text-sm text-ink-2">
            We’re launching on the App Store and Google Play soon. Your plan is saved: sign in with
            the same Google account and it’ll be waiting for you.
          </p>
        </div>
      </div>
      <a href={APP_LINK} className={`${onboardingButton} lg:hidden`}>
        <Smartphone className="size-5" aria-hidden />
        Already have the app? Open it
      </a>
    </div>
  );
}
