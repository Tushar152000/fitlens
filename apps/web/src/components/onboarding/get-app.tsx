import { BellRing, Smartphone } from "lucide-react";
import Image from "next/image";
import { StoreBadges, storeLinks } from "@/components/store-links";
import { onboardingButton } from "./button-styles";

/** The app's deep link (apps/mobile app.json "scheme"); opens Today when the app is installed. */
export const APP_LINK = "fitlens://today";

/**
 * Where people get the phone app. Live: a QR card on desktop, "Open the FITR8 app" + badges on
 * phones. Before launch (no store URLs yet): a "coming soon" card that says the plan is saved.
 */
export function GetAppCard({ email }: { email?: string | null }) {
  if (!storeLinks().live) {
    return (
      <div className="flex items-start gap-4 rounded-3xl bg-white p-5 shadow-hard">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-fitr8 text-white">
          <BellRing className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold">The app is almost here</p>
          <p className="mt-1 text-sm text-ink-2">
            FITR8 for iPhone and Android is coming soon. Your plan is saved to your account and will
            be waiting when you sign in
            {email ? (
              <>
                . We’ll let you know at <b className="text-fitr8-ink">{email}</b> when it’s live.
              </>
            ) : (
              "."
            )}
          </p>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="hidden items-center gap-[18px] rounded-3xl bg-white p-5 shadow-hard lg:flex">
        <Image
          src="/landing/qr-code.png"
          alt="QR code to download the FITR8 app"
          width={132}
          height={132}
          className="size-[132px] shrink-0 rounded-[10px]"
        />
        <div>
          <p className="text-lg font-semibold">Scan with your phone camera</p>
          <p className="mt-1 text-sm text-ink-2">
            Opens the App Store or Google Play. Already installed? It opens your plan.
          </p>
          <StoreBadges className="mt-3" />
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:hidden">
        <a href={APP_LINK} className={onboardingButton}>
          <Smartphone className="size-5" aria-hidden />
          Open the FITR8 app
        </a>
        <p className="text-center text-[13px] text-ink-3">
          Don’t have it yet? Get it from your store:
        </p>
        <StoreBadges className="justify-center" />
      </div>
    </>
  );
}
