import { Smartphone } from "lucide-react";
import Image from "next/image";
import { onboardingButton } from "./shell";

/** The app's deep link (apps/mobile app.json "scheme"); opens Today when the app is installed. */
export const APP_LINK = "fitlens://today";

/**
 * Where people get the phone app: a QR card on desktop, an "Open the FITR8 app" button plus store
 * badges on phones.
 */
export function GetAppCard() {
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

function StoreBadges({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2.5 ${className ?? ""}`}>
      <Image
        src="/landing/badge-app-store.png"
        alt="Download on the App Store"
        width={114}
        height={38}
        className="h-[38px] w-auto rounded-[7px]"
      />
      <Image
        src="/landing/badge-google-play.png"
        alt="Get it on Google Play"
        width={98}
        height={38}
        className="h-[38px] w-auto rounded-[7px]"
      />
    </div>
  );
}
